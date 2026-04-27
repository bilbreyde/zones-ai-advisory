import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Bot, Sparkles, Zap } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from './ChatVisual.jsx'
import { getCheckInQuestion } from '../lib/staleness.js'
import './AIChat.css'

const API = import.meta.env.VITE_API_URL || ''

/* ── Dynamic starter generation ───────────────────────────────────────── */

function getDynamicStarters(client, envProfile) {
  if (!client) return [
    "What is AI maturity?",
    "How does an AI advisory engagement work?",
    "What are the 5 pillars of AI governance?",
    "What types of AI agents are most common?",
  ]

  const starters    = []
  const scores      = client.scores || {}
  const deployment  = envProfile?.deploymentModel
  const compliance  = envProfile?.complianceFrameworks || []
  const legacy      = envProfile?.legacySystems || []

  // Lowest pillar first
  const sorted = Object.entries(scores)
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => a - b)

  if (sorted[0]) {
    const [pillar, score] = sorted[0]
    const pillarLabels = {
      governance: 'Governance',
      risk:       'Risk & Compliance',
      strategy:   'AI Strategy',
      operations: 'Operations',
      enablement: 'Enablement',
    }
    starters.push(`Suggest a 90-day plan to improve our ${pillarLabels[pillar]} score from ${score}/5`)
  }

  // Environment-specific starters
  if (deployment === 'air_gapped')          starters.push("What AI agents can run fully on-premises with no internet dependency?")
  if (deployment === 'on_prem')             starters.push("What AI architectures work best for on-premises environments?")
  if (deployment === 'hybrid')              starters.push("How do we design AI agents that work across cloud and on-premises?")
  if (compliance.includes('hipaa'))         starters.push("How do we ensure our AI initiatives are HIPAA compliant?")
  if (compliance.includes('fedramp'))       starters.push("What AI deployment patterns meet FedRAMP requirements?")
  if (legacy.length > 0) {
    starters.push(`How do we bridge our legacy systems (${legacy.slice(0, 2).join(', ')}) to modern AI workflows?`)
  }

  // Always include these
  starters.push("How does this client compare to industry benchmarks?")
  starters.push("What should we prioritise in the executive readout?")

  return starters.slice(0, 4)
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function AIChat() {
  const { client }  = useClient()
  const navigate    = useNavigate()

  const [messages,         setMessages]         = useState([])
  const [input,            setInput]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [collapsedVisuals, setCollapsedVisuals] = useState({})
  const [assessmentCache,  setAssessmentCache]  = useState({})
  const [envProfile,       setEnvProfile]       = useState(null)
  const bottomRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch assessment data for context
  useEffect(() => {
    if (!client?.id || assessmentCache[client.id]) return
    fetch(`${API}/api/assessments/${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAssessmentCache(prev => ({ ...prev, [client.id]: data })) })
      .catch(() => {})
  }, [client?.id])

  // Fetch full client record for fresh environment profile
  useEffect(() => {
    if (!client?.id) { setEnvProfile(null); return }
    fetch(`${API}/api/clients/${client.id}`)
      .then(r => r.json())
      .then(data => setEnvProfile(data.environmentProfile || null))
      .catch(() => {})
  }, [client?.id])

  // Set opening message — resets conversation when client changes
  useEffect(() => {
    if (!client?.id) {
      setMessages([{
        role: 'assistant',
        content: "I'm your Zones AI Advisory assistant. Select a client to get personalised recommendations.",
        visual: null, visuals: null, showAgentStudio: false,
      }])
      return
    }

    const lastUpdated = client.environmentProfile?.updatedAt || client.updatedAt
    const daysSince   = lastUpdated
      ? Math.floor((Date.now() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24))
      : null

    let openingMessage = `I'm your Zones AI Advisory assistant. I can help analyse this client's assessment, suggest recommendations, and prepare talking points for your session. What would you like to explore?`

    if (daysSince !== null && daysSince > 45) {
      const env    = client.environmentProfile
      const checkIn = getCheckInQuestion(client, env)
      openingMessage = `I'm your Zones AI Advisory assistant. I notice ${client.name}'s profile was last updated ${daysSince} days ago. Before we dive in — ${checkIn}\n\nOr ask me anything about this client's assessment.`
    }

    setMessages([{
      role: 'assistant',
      content: openingMessage,
      visual: null, visuals: null, showAgentStudio: false,
    }])
  }, [client?.id])

  // Dynamic starter prompts
  const dynamicStarters = useMemo(
    () => getDynamicStarters(client, envProfile),
    [client?.id, envProfile]
  )

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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          clientContext: client ? {
            name:               client.name,
            industry:           client.industry,
            size:               client.size,
            scores:             client.scores,
            overallScore:       client.overallScore,
            answers:            assessmentData?.answers || {},
            environmentProfile: envProfile,
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
                  <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>{m.content}</div>
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

      {/* Starters or no-client banner */}
      {!client ? (
        <div className="no-client-banner">
          <div className="ncb-icon">⚠️</div>
          <div>
            <div className="ncb-title">No client selected</div>
            <div className="ncb-desc">Responses will be generic and not tailored to any client. Select a client for personalised advisory assistance.</div>
          </div>
        </div>
      ) : (
        <div className="chat-starters">
          {dynamicStarters.map((s, i) => (
            <button key={i} className="starter-btn" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={client ? `Ask about ${client.name}…` : 'Ask a general question…'}
        />
        <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
