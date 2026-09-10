import { describe, expect, it } from 'vitest'
import { FakeChatService } from '../../src/services/fakeChatService'
import { getErrorMessage } from '../../src/services/chatService'

describe('FakeChatService', () => {
  it('returns a deterministic response without a live model', async () => {
    const service = new FakeChatService('GST answer from fake model')

    await expect(service.ask('What is GST?', [])).resolves.toBe('GST answer from fake model')
  })

  it('receives the question and current conversation history', async () => {
    const service = new FakeChatService((question, history) => `${question} after ${history.length} turns`)

    await expect(service.ask('Follow up', [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
    ])).resolves.toBe('Follow up after 2 turns')
  })
})

describe('service errors', () => {
  it('turns configuration errors into safe user-facing text', () => {
    expect(getErrorMessage(new Error('MISSING_GOOGLE_API_KEY'))).toMatch(/not configured/i)
    expect(getErrorMessage(new Error('secret-key-value'))).not.toContain('secret-key-value')
  })
})
