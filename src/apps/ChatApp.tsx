import { useState } from 'react'
import type { ChatMessage } from '../os/types'

type ChatAppProps = {
  messages: ChatMessage[]
  busy: boolean
  onAsk: (question: string) => Promise<void>
}

export function ChatApp({ messages, busy, onAsk }: ChatAppProps) {
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
        {messages.length === 0 ? <p className="app-muted">Ask: “Explain this repo” or “Where is main logic?”</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`chat-line chat-${message.role}`}>
            <span className="chat-role">{message.role === 'user' ? 'you' : 'ai'}</span>
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
          placeholder="Ask about current repository..."
        />
        <button className="os-btn" onClick={() => void submit()} disabled={busy}>
          Ask
        </button>
      </div>
    </div>
  )
}
