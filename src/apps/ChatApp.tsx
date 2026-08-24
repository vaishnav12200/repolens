import { useState } from 'react'
import type { ChatMessage } from '../os/types'

type ChatAppProps = {
  messages: ChatMessage[]
  busy: boolean
  onAsk: (question: string) => Promise<void>
  onClear: () => void
}

export function ChatApp({ messages, busy, onAsk, onClear }: ChatAppProps) {
  const [question, setQuestion] = useState('')

  const submit = async () => {
    const trimmed = question.trim()
    if (!trimmed || busy) return
    setQuestion('')
    await onAsk(trimmed)
  }

  return (
    <div className="chat-wrap">
      <div className="chat-scroll">
        {messages.length === 0 ? <p className="app-muted">Ask anything. Analyze a repository first when you want answers grounded in its code.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`chat-line chat-${message.role}`}>
            <span className="chat-role">{message.role === 'user' ? 'you' : 'assistant'}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
            }
          }}
          className="os-input"
          placeholder="Ask anything, or ask about an analyzed repository..."
        />
        <button className="os-btn" onClick={() => void submit()} disabled={busy}>
          Get Insight
        </button>
        <button className="os-btn os-btn-muted" onClick={onClear} disabled={busy || messages.length === 0}>
          Clear chat
        </button>
      </div>
    </div>
  )
}
