import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import type { ChatService } from '../../src/services/chatService'
import { FakeChatService } from '../../src/services/fakeChatService'

describe('CA Buddy chat shell', () => {
  it('renders the one-screen controls and disclaimer', () => {
    render(<App chatService={new FakeChatService('GST answer from fake model')} />)

    expect(screen.getByRole('heading', { name: 'CA Buddy' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CA Buddy conversation' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /tax or audit question/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/not professional advice/i)
  })

  it('adds a non-empty question and supports starting a new chat', async () => {
    const user = userEvent.setup()
    render(<App chatService={new FakeChatService('GST answer from fake model')} />)
    const input = screen.getByRole('textbox', { name: /tax or audit question/i })

    await user.type(input, 'When is my GST return due?')
    await user.click(screen.getByRole('button', { name: /send question/i }))

    expect(screen.getByText('When is my GST return due?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send question/i })).toBeDisabled()

    expect(await screen.findByText(/GST answer from fake model/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /new chat/i }))
    expect(screen.queryByText('When is my GST return due?')).not.toBeInTheDocument()
  })

  it('passes current conversation context to follow-up questions', async () => {
    const service = new FakeChatService((question, history) => `${question} (${history.length} prior turns)`)
    const user = userEvent.setup()
    render(<App chatService={service} />)
    const input = screen.getByRole('textbox', { name: /tax or audit question/i })

    await user.type(input, 'What is GST?')
    await user.click(screen.getByRole('button', { name: /send question/i }))
    expect(await screen.findByText('What is GST? (0 prior turns)')).toBeInTheDocument()

    await user.type(input, 'And what about TDS?')
    await user.click(screen.getByRole('button', { name: /send question/i }))
    expect(await screen.findByText('And what about TDS? (2 prior turns)')).toBeInTheDocument()
  })

  it('shows a safe error when answer retrieval fails', async () => {
    const service: ChatService = {
      ask: async () => { throw new Error('provider-secret') },
    }
    const user = userEvent.setup()
    render(<App chatService={service} />)

    await user.type(screen.getByRole('textbox', { name: /tax or audit question/i }), 'Help')
    await user.click(screen.getByRole('button', { name: /send question/i }))

    expect(await screen.findByText(/could not complete that answer/i)).toBeInTheDocument()
    expect(screen.queryByText(/provider-secret/i)).not.toBeInTheDocument()
  })
})
