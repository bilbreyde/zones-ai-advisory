import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from './ChatVisual.jsx'
import './AIChat.css'

const STARTERS = [
  "What's the biggest gap for this client?",
  "Suggest a 90-day risk improvement plan",
  "How does this client compare to industry benchmarks?",
  "What should we prioritize in the executive readout?",
]

export default function AIChat() {
  const { client } = useClient()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I'm your Zones AI Advisory assistant. I can help analyze this client's assessment, suggest recommendations, and prepare talking points for your session. What would you like to explore?",
      visual: null,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsedVisuals, setCollapsedVisuals] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function toggleVisual(idx) {
    setCollapsedVisuals(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userMsg, visual: null }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Strip visual before sending — API only needs role + content
      const apiMessages = newMessages.map(({ role, content }) => ({ role, content }))
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          clientContext: client ? { name: client.name, scores: client.scores, overallScore: client.overallScore } : null,
        })
      })
      const data = await res.json()
      console.log('[AIChat] response:', data)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, visual: data.visual || null }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check the backend server is running.',
        visual: null,
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
            {m.role === 'assistant' && m.visual ? (
              <div className="msg-content">
                <div className="msg-bubble">{m.content}</div>
                {!collapsedVisuals[i] && (
                  <div className="msg-visual">
                    <ChatVisual visual={m.visual} />
                  </div>
                )}
                <button className="visual-toggle" onClick={() => toggleVisual(i)}>
                  {collapsedVisuals[i] ? 'Show visual' : 'Hide visual'}
                </button>
              </div>
            ) : (
              <div className="msg-bubble">{m.content}</div>
            )}
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
