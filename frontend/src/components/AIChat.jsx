import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Bot, Sparkles, Zap } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from './ChatVisual.jsx'
import './AIChat.css'

const API = import.meta.env.VITE_API_URL || ''

const STARTERS = [
  "What's the biggest gap for this client?",
  "Suggest a 90-day risk improvement plan",
  "How does this client compare to industry benchmarks?",
  "What should we prioritize in the executive readout?",
]

export default function AIChat() {
  const { client } = useClient()
  const navigate   = useNavigate()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I'm your Zones AI Advisory assistant. I can help analyze this client's assessment, suggest recommendations, and prepare talking points for your session. What would you like to explore?",
      visual: null,
      visuals: null,
      showAgentStudio: false,
    }
  ])
  const [input,            setInput]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [collapsedVisuals, setCollapsedVisuals] = useState({})
  const [assessmentCache,  setAssessmentCache]  = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!client?.id || assessmentCache[client.id]) return
    fetch(`${API}/api/assessments/${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAssessmentCache(prev => ({ ...prev, [client.id]: data })) })
      .catch(() => {})
  }, [client?.id])

  function toggleVisual(idx) {
    setCollapsedVisuals(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userMsg, visual: null, visuals: null, showAgentStudio: false }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const apiMessages    = newMessages.map(({ role, content }) => ({ role, content }))
      const assessmentData = assessmentCache[client?.id]

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          clientContext: client ? {
            name:         client.name,
            scores:       client.scores,
            overallScore: client.overallScore,
            industry:     client.industry,
            size:         client.size,
            answers:      assessmentData?.answers || {},
          } : null,
        }),
      })

      const data = await res.json()
      setMessages(prev => [...prev, {
        role:            'assistant',
        content:         data.reply,
        visual:          data.visual          || null,
        visuals:         data.visuals         || null,
        showAgentStudio: data.showAgentStudio || false,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'Connection error. Please check the backend server is running.',
        visual: null, visuals: null, showAgentStudio: false,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat">
      <div className="chat-header">
        <div className="chat-header-icon"><Bot size={14} /></div>
        <div>
          <div className="chat-title">AI Advisory Assistant</div>
          <div className="chat-sub">Azure OpenAI · GPT-4o</div>
        </div>
        <div className="online-dot" />
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => {
          const hasVisual  = !!(m.visual)
          const hasVisuals = !!(m.visuals?.length)
          const showExpand = m.role === 'assistant' && (hasVisual || hasVisuals)

          return (
            <div key={i} className={`message ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="msg-avatar"><Sparkles size={10} /></div>
              )}
              {showExpand ? (
                <div className="msg-content">
                  {m.content && <div className="msg-bubble">{m.content}</div>}
                  {!collapsedVisuals[i] && (
                    <div className="msg-visual">
                      {hasVisuals
                        ? m.visuals.map((v, vi) => <ChatVisual key={vi} visual={v} />)
                        : <ChatVisual visual={m.visual} />
                      }
                    </div>
                  )}
                  <button className="visual-toggle" onClick={() => toggleVisual(i)}>
                    {collapsedVisuals[i] ? 'Show visual' : 'Hide visual'}
                  </button>
                  {m.showAgentStudio && (
                    <button className="chat-action-btn" onClick={() => navigate('/agents')}>
                      <Zap size={11} /> Open Agent Studio{client?.name ? ` for ${client.name}` : ''} →
                    </button>
                  )}
                </div>
              ) : (
                <div className="msg-content">
                  <div className="msg-bubble">{m.content}</div>
                  {m.showAgentStudio && (
                    <button className="chat-action-btn" onClick={() => navigate('/agents')}>
                      <Zap size={11} /> Open Agent Studio{client?.name ? ` for ${client.name}` : ''} →
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div className="message assistant">
            <div className="msg-avatar"><Sparkles size={10} /></div>
            <div className="msg-bubble typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-starters">
        {STARTERS.map((s, i) => (
          <button key={i} className="starter-btn" onClick={() => send(s)}>{s}</button>
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
