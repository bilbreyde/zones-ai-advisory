import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles } from 'lucide-react'
import './AIChat.css'

const STARTERS = [
  "What's the biggest gap for this client?",
  "Suggest a 90-day risk improvement plan",
  "How does this client compare to industry benchmarks?",
  "What should we prioritize in the executive readout?",
]

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I'm your Zones AI Advisory assistant. I can help analyze this client's assessment, suggest recommendations, and prepare talking points for your session. What would you like to explore?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check the backend server is running.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat">
      <div className="chat-header">
        <div className="chat-header-icon">
          <Bot size={14} />
        </div>
        <div>
          <div className="chat-title">AI Advisory Assistant</div>
          <div className="chat-sub">Azure OpenAI · GPT-4o</div>
        </div>
        <div className="online-dot" />
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.role === 'assistant' && (
              <div className="msg-avatar"><Sparkles size={10} /></div>
            )}
            <div className="msg-bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="msg-avatar"><Sparkles size={10} /></div>
            <div className="msg-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-starters">
        {STARTERS.map((s, i) => (
          <button key={i} className="starter-btn" onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about this client…"
        />
        <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
