#!/usr/bin/env bash
set -euo pipefail

# Resolve paths from the script location so the command works from any directory.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR"
BACKEND_DIR="$ROOT_DIR"
LOG_DIR="$ROOT_DIR/logs"
RUNTIME_DIR="$ROOT_DIR/.run"
FRONTEND_PORT="5173"
BACKEND_PORT="8000"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"

BACKEND_PID=""
FRONTEND_PID=""
FOREGROUND=false

# Kill a process and its children so npm wrappers do not leave Vite or a backend behind.
kill_tree() {
  local pid="$1"
  local child

  if [[ -r "/proc/${pid}/task/${pid}/children" ]]; then
    while read -r child; do
      [[ -n "$child" ]] && kill_tree "$child"
    done <"/proc/${pid}/task/${pid}/children"
  fi

  kill "$pid" 2>/dev/null || true
}

# Stop the listener on a launcher-owned port when a package wrapper replaced its PID.
stop_port_owner() {
  local port="$1"
  local pid

  if command -v lsof >/dev/null 2>&1; then
    while read -r pid; do
      [[ -n "$pid" ]] && kill_tree "$pid"
    done < <(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    for pid in $(fuser -n tcp "$port" 2>/dev/null || true); do
      kill_tree "$pid"
    done
  fi
}

case "${1:-}" in
  --foreground)
    FOREGROUND=true
    ;;
  stop)
    if [[ -f "$RUNTIME_DIR/frontend.pid" ]]; then
      kill_tree "$(cat "$RUNTIME_DIR/frontend.pid")"
      rm -f "$RUNTIME_DIR/frontend.pid"
    fi
    if [[ -f "$RUNTIME_DIR/backend.pid" ]]; then
      kill_tree "$(cat "$RUNTIME_DIR/backend.pid")"
      rm -f "$RUNTIME_DIR/backend.pid"
    fi
    stop_port_owner "$FRONTEND_PORT"
    stop_port_owner "$BACKEND_PORT"
    printf 'CA Buddy services stopped.\n'
    exit 0
    ;;
  "")
    ;;
  *)
    printf 'Usage: %s [--foreground|stop]\n' "$0" >&2
    exit 2
    ;;
esac

# Stop child processes and their process groups when the script exits or is interrupted.
cleanup() {
  trap - EXIT INT TERM
  printf '\nStopping CA Buddy...\n'

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill_tree "$FRONTEND_PID"
  fi

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill_tree "$BACKEND_PID"
  fi
}

if [[ "$FOREGROUND" == true ]]; then
  trap cleanup EXIT INT TERM
fi

# Look for a Python backend and choose a standard command when one exists.
detect_backend() {
  BACKEND_COMMAND=""
  BACKEND_PORT="8000"

  if [[ -f "$BACKEND_DIR/manage.py" ]]; then
    BACKEND_COMMAND="python3 manage.py runserver 127.0.0.1:${BACKEND_PORT}"
    return
  fi

  local entry_point=""
  if [[ -f "$BACKEND_DIR/app.py" ]]; then
    entry_point="app.py"
  elif [[ -f "$BACKEND_DIR/main.py" ]]; then
    entry_point="main.py"
  fi

  if [[ -z "$entry_point" ]]; then
    return
  fi

  if grep -qE 'fastapi|FastAPI|uvicorn' "$BACKEND_DIR/$entry_point"; then
    BACKEND_COMMAND="uvicorn ${entry_point%.py}:app --host 127.0.0.1 --port ${BACKEND_PORT}"
  elif grep -qE 'flask|Flask' "$BACKEND_DIR/$entry_point"; then
    BACKEND_PORT="5000"
    BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
    BACKEND_COMMAND="flask --app ${entry_point} run --host 127.0.0.1 --port ${BACKEND_PORT}"
  else
    BACKEND_COMMAND="python3 ${entry_point}"
  fi
}

# Wait for a local HTTP service to answer, failing after roughly 30 seconds.
wait_for_url() {
  local url="$1"
  local service_name="$2"
  local attempts=30

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --silent --show-error --fail --max-time 1 "$url" >/dev/null 2>&1; then
      printf '%s is ready at %s\n' "$service_name" "$url"
      return 0
    fi
    sleep 1
  done

  printf 'ERROR: %s did not become reachable at %s within 30 seconds.\n' "$service_name" "$url" >&2
  return 1
}

# Warn when Gemini is not configured, but still launch the frontend so its safe
# in-app configuration message can be viewed in the browser.
check_google_api_key() {
  if [[ -n "${VITE_GOOGLE_API_KEY:-}" ]]; then
    return 0
  fi

  if [[ -f "$ROOT_DIR/.env" ]] && awk -F= '
    $1 == "VITE_GOOGLE_API_KEY" {
      value = $2
      gsub(/[[:space:]\"]/, "", value)
      if (length(value) > 0) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$ROOT_DIR/.env"; then
    return 0
  fi

  printf 'ERROR: VITE_GOOGLE_API_KEY is not configured.\n' >&2
  printf 'Create %s/.env with:\n' "$ROOT_DIR" >&2
  printf 'VITE_GOOGLE_API_KEY=your-gemini-api-key\n' >&2
  printf 'The frontend will still start, but chat answers need the key.\n' >&2
}

# Detect and start the backend from its own directory, activating a local venv first.
printf 'Detecting application stack...\n'
detect_backend
check_google_api_key
mkdir -p "$LOG_DIR"
mkdir -p "$RUNTIME_DIR"

# Remove PID files for services that are no longer running.
for pid_file in "$RUNTIME_DIR/frontend.pid" "$RUNTIME_DIR/backend.pid"; do
  if [[ -f "$pid_file" ]] && ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    rm -f "$pid_file"
  fi
done

if [[ -n "$BACKEND_COMMAND" ]]; then
  printf 'Starting backend on port %s...\n' "$BACKEND_PORT"
  if [[ "$FOREGROUND" == true ]]; then
    (
      cd "$BACKEND_DIR"
      if [[ -f .venv/bin/activate ]]; then
        # shellcheck disable=SC1091
        source .venv/bin/activate
      elif [[ -f venv/bin/activate ]]; then
        # shellcheck disable=SC1091
        source venv/bin/activate
      fi
      exec $BACKEND_COMMAND
    ) >"$LOG_DIR/backend.log" 2>&1 &
  else
    nohup bash -c '
      cd "$1"
      if [[ -f .venv/bin/activate ]]; then source .venv/bin/activate; fi
      if [[ -f venv/bin/activate ]]; then source venv/bin/activate; fi
      exec bash -c "$2"
    ' _ "$BACKEND_DIR" "$BACKEND_COMMAND" >"$LOG_DIR/backend.log" 2>&1 &
  fi
  BACKEND_PID=$!
  printf '%s\n' "$BACKEND_PID" >"$RUNTIME_DIR/backend.pid"
  wait_for_url "$BACKEND_URL" "Backend"
else
  printf 'No backend entry point detected; running the frontend-only application.\n'
  : >"$LOG_DIR/backend.log"
fi

# Install frontend packages only when the dependency directory is absent, then start Vite.
printf 'Starting frontend on port %s...\n' "$FRONTEND_PORT"
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  (
    cd "$FRONTEND_DIR"
    npm install
  ) >"$LOG_DIR/frontend.log" 2>&1
fi
if [[ "$FOREGROUND" == true ]]; then
  (
    cd "$FRONTEND_DIR"
    exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
  ) >>"$LOG_DIR/frontend.log" 2>&1 &
else
  nohup bash -c '
    cd "$1"
    exec npm run dev -- --host 127.0.0.1 --port "$2"
  ' _ "$FRONTEND_DIR" "$FRONTEND_PORT" >>"$LOG_DIR/frontend.log" 2>&1 &
fi
FRONTEND_PID=$!
printf '%s\n' "$FRONTEND_PID" >"$RUNTIME_DIR/frontend.pid"
wait_for_url "$FRONTEND_URL" "Frontend"

# Open the app with Google Chrome when available, then use the platform fallback.
printf 'Opening browser...\n'
case "$(uname -s)" in
  Linux)
    if command -v google-chrome >/dev/null 2>&1; then
      google-chrome "$FRONTEND_URL" >/dev/null 2>&1 &
    elif command -v google-chrome-stable >/dev/null 2>&1; then
      google-chrome-stable "$FRONTEND_URL" >/dev/null 2>&1 &
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
      printf 'Chrome was not found; opened the URL with xdg-open: %s\n' "$FRONTEND_URL"
    else
      printf 'Chrome was not found. Open this URL manually: %s\n' "$FRONTEND_URL"
    fi
    ;;
  Darwin)
    if command -v open >/dev/null 2>&1; then
      open -a "Google Chrome" "$FRONTEND_URL" >/dev/null 2>&1 &
    else
      printf 'Google Chrome launcher was not found. Open this URL manually: %s\n' "$FRONTEND_URL"
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    if command -v start >/dev/null 2>&1; then
      start chrome "$FRONTEND_URL" >/dev/null 2>&1 &
    else
      printf 'Chrome launcher was not found. Open this URL manually: %s\n' "$FRONTEND_URL"
    fi
    ;;
  *)
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
      printf 'Opened the URL with xdg-open: %s\n' "$FRONTEND_URL"
    else
      printf 'Open this URL manually: %s\n' "$FRONTEND_URL"
    fi
    ;;
esac

printf 'CA Buddy is running at %s. Press Ctrl+C to stop it.\n' "$FRONTEND_URL"

if [[ "$FOREGROUND" == true ]]; then
  wait "$FRONTEND_PID"
else
  printf 'Services are detached and will keep running after this terminal closes.\n'
  printf 'Use %s stop to stop them.\n' "$0"
fi
