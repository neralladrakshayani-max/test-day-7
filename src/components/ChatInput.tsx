import { ArrowUp } from 'lucide-react'
import type { FormEvent } from 'react'

interface ChatInputProps {
  value: string
  pending: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function ChatInput({ value, pending, onChange, onSubmit }: ChatInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pending && value.trim()) {
      onSubmit()
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="question-input">
        Ask a tax or audit question
      </label>
      <textarea
        id="question-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask about GST, TDS, ITR deadlines, or audit basics..."
        rows={1}
        disabled={pending}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button
        className="send-button"
        type="submit"
        disabled={pending || !value.trim()}
        aria-label="Send question"
        title="Send question"
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </form>
  )
}
