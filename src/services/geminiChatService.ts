import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatService, ConversationTurn } from './chatService'
import { CA_SYSTEM_PROMPT } from './caSystemPrompt'

const modelName = 'gemini-3.6-flash'

export class GeminiChatService implements ChatService {
  private readonly model: ChatGoogleGenerativeAI

  constructor(apiKey = import.meta.env.VITE_GOOGLE_API_KEY) {
    if (!apiKey) {
      throw new Error('MISSING_GOOGLE_API_KEY')
    }

    this.model = new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      maxOutputTokens: 1024,
      temperature: 0.2,
      maxRetries: 0,
    })
  }

  async ask(question: string, history: ConversationTurn[]): Promise<string> {
    const messages = [
      new SystemMessage(CA_SYSTEM_PROMPT),
      ...history.map((turn) => turn.role === 'user'
        ? new HumanMessage(turn.content)
        : new AIMessage(turn.content)),
      new HumanMessage(question),
    ]
    const response = await this.model.invoke(messages)
    return typeof response.content === 'string'
      ? response.content
      : response.content.map((block) => typeof block === 'string' ? block : JSON.stringify(block)).join(' ')
  }
}
