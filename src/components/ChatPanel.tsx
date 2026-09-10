import { MessageCircle, RotateCcw } from 'lucide-react'
import type { Message } from '../types/chat'
import { ChatInput } from './ChatInput'

interface ChatPanelProps {
  messages: Message[]
  draft: string
  pending: boolean
  onDraftChange: (value: string) => void
  onSubmit: () => void
  onNewChat: () => void
}

export function ChatPanel({
  messages,
  draft,
  pending,
  onDraftChange,
  onSubmit,
  onNewChat,
}: ChatPanelProps) {
  return (
    <section className="chat-shell" aria-label="CA Buddy conversation">
      <div className="chat-toolbar">
        <div className="panel-label">
          <MessageCircle size={17} />
          <span>Conversation</span>
        </div>
        <button className="new-chat-button" type="button" onClick={onNewChat}>
          <RotateCcw size={15} />
          <span>New chat</span>
        </button>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark">CA</span>
            <h2>What can I help you untangle?</h2>
            <p>Start with a practical question about your business taxes or audit basics.</p>
          </div>
        ) : (
          messages.map((message) => (
            <article className={`message message-${message.role}`} key={message.id}>
              <span className="message-role">{message.role === 'user' ? 'You' : 'CA Buddy'}</span>
              <p>{message.content}</p>
            </article>
          ))
        )}
        {pending && (
          <div className="message message-assistant pending-message" aria-label="CA Buddy is thinking">
            <span className="message-role">CA Buddy</span>
            <p className="typing-dots"><span /> <span /> <span /></p>
          </div>
        )}
      </div>

      <ChatInput
        value={draft}
        pending={pending}
        onChange={onDraftChange}
        onSubmit={onSubmit}
      />
      <p className="input-hint">Press Enter to send · Shift + Enter for a new line</p>
    </section>
  )
}
