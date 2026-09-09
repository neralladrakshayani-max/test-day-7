export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatService {
  ask(question: string, history: ConversationTurn[]): Promise<string>
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'MISSING_GOOGLE_API_KEY') {
    return 'CA Buddy is not configured yet. Please add a Gemini API key and try again.'
  }

  return 'CA Buddy could not complete that answer. Please try again or consult a CA.'
}
