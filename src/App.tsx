import { useRef, useState } from 'react'
import { BadgeIndianRupee, ShieldCheck } from 'lucide-react'
import { ChatPanel } from './components/ChatPanel'
import { Disclaimer } from './components/Disclaimer'
import { GeminiChatService } from './services/geminiChatService'
import { getErrorMessage } from './services/chatService'
import type { ChatService, ConversationTurn } from './services/chatService'
import type { Message } from './types/chat'

interface AppProps {
  chatService?: ChatService
}

function createMessage(role: Message['role'], content: string): Message {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, content }
}

export default function App({ chatService }: AppProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const requestId = useRef(0)

  const handleSubmit = () => {
    const question = draft.trim()
    if (!question || pending) return

    const history: ConversationTurn[] = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }))
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    setDraft('')
    setMessages((current) => [...current, createMessage('user', question)])
    setPending(true)

    let service: ChatService
    try {
      service = chatService ?? new GeminiChatService()
    } catch (error: unknown) {
      setMessages((current) => [...current, createMessage('error', getErrorMessage(error))])
      setPending(false)
      return
    }

    void service.ask(question, history)
      .then((answer) => {
        if (requestId.current !== currentRequest) return
        setMessages((current) => [...current, createMessage('assistant', answer)])
      })
      .catch((error: unknown) => {
        if (requestId.current !== currentRequest) return
        setMessages((current) => [...current, createMessage('error', getErrorMessage(error))])
      })
      .finally(() => {
        if (requestId.current === currentRequest) setPending(false)
      })
  }

  const handleNewChat = () => {
    requestId.current += 1
    setMessages([])
    setDraft('')
    setPending(false)
  }

  return (
    <main className="app-frame">
      <div className="app-glow app-glow-left" />
      <div className="app-glow app-glow-right" />
      <div className="app-content">
        <header className="app-header">
          <div className="brand-lockup">
            <div className="brand-mark"><BadgeIndianRupee size={22} /></div>
            <div>
              <p className="eyebrow">Everyday tax clarity</p>
              <h1>CA Buddy</h1>
            </div>
          </div>
          <div className="trust-chip"><ShieldCheck size={16} /> General guidance</div>
        </header>

        <section className="intro-copy">
          <p className="kicker">For India&apos;s small-business owners</p>
          <h2>Good questions deserve clear next steps.</h2>
          <p>Get a practical first read on GST, TDS, ITR deadlines, and audit basics, then know when it&apos;s time to bring in a CA.</p>
        </section>

        <ChatPanel
          messages={messages}
          draft={draft}
          pending={pending}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          onNewChat={handleNewChat}
        />
        <Disclaimer />
      </div>
    </main>
  )
}
