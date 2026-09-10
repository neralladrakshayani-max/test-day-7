import type { ChatService, ConversationTurn } from './chatService'

export type FakeResponse = string | ((question: string, history: ConversationTurn[]) => string)

export class FakeChatService implements ChatService {
  constructor(private readonly response: FakeResponse = 'Fake CA Buddy response') {}

  async ask(question: string, history: ConversationTurn[]): Promise<string> {
    return typeof this.response === 'function'
      ? this.response(question, history)
      : this.response
  }
}
