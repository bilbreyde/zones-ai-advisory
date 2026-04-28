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

  const pillarLabels = {
    governance: 'Governance',
    risk:       'Risk & Compliance',
    strategy:   'AI Strategy',
    operations: 'Operations',
    enablement: 'Enablement',
  }

  // Lowest pillar first
  const sorted = Object.entries(scores)
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => a - b)

  if (sorted[0]) {
    const [pillar, score] = sorted[0]
    const label = pillarLabels[pillar] || pillar
    // Comprehensive strategic plan as the very first starter
    starters.unshift(`Create a comprehensive plan to improve ${label} maturity at ${client.name} — include architecture, 90-day execution plan, and quick wins`)
    starters.push(`Suggest a 90-day plan to improve our ${label} score from ${score}/5`)
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
  const [exportingIndex,   setExportingIndex]   = useState(null) // number | 'all' | null
  const [copiedIndex,      setCopiedIndex]      = useState(null)
  const [expandedMessage,   setExpandedMessage]   = useState(null)
  const [showExpandedPanel, setShowExpandedPanel] = useState(false)
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

  function openInPanel(message, messageIndex) {
    const precedingMsg = messages[messageIndex - 1]
    const title = precedingMsg?.content?.slice(0, 80) || 'Advisory Analysis'
    setExpandedMessage({
      title,
      reply:        message.content,
      visuals:      message.visuals?.length ? message.visuals : (message.visual ? [message.visual] : []),
      message,
      messageIndex,
    })
    setShowExpandedPanel(true)
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

  /* ── PDF export helpers ─────────────────────────────────────────────── */

  function makePdfHeader(pdf, pageWidth, margin) {
    pdf.setFillColor(10, 22, 40)
    pdf.rect(0, 0, pageWidth, 36, 'F')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 130, 180)
    pdf.text('ZONES AI ADVISORY FRAMEWORK', margin, 10)
    pdf.setFontSize(13)
    pdf.setTextColor(244, 246, 250)
    pdf.text(`${client?.name || 'Client'} — Advisory Analysis`, margin, 20)
    pdf.setFontSize(8)
    pdf.setTextColor(120, 150, 190)
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    pdf.text(`Generated ${dateStr}  ·  Confidential`, margin, 28)
    pdf.setDrawColor(74, 159, 224)
    pdf.setLineWidth(0.5)
    pdf.line(margin, 33, pageWidth - margin, 33)
  }

  async function captureVisuals(msgEl, pdf, yPos, pageWidth, pageHeight, margin, contentWidth) {
    const wrappers = msgEl?.querySelectorAll('.chat-visual-wrapper') || []
    for (const wrapper of wrappers) {
      wrapper.scrollIntoView({ block: 'center' })
      await new Promise(r => setTimeout(r, 200))
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(wrapper, {
        scale: 2, useCORS: true, backgroundColor: '#0A1628', logging: false,
        windowWidth: wrapper.scrollWidth, windowHeight: wrapper.scrollHeight,
      })
      const imgData    = canvas.toDataURL('image/png')
      const rawH       = (canvas.height / canvas.width) * contentWidth
      const maxH       = pageHeight - margin * 2
      const finalH     = Math.min(rawH, maxH)
      const finalW     = rawH > maxH ? contentWidth * (maxH / rawH) : contentWidth
      if (yPos + finalH > pageHeight - margin) {
        pdf.addPage()
        pdf.setFontSize(7); pdf.setTextColor(100, 130, 180)
        pdf.text(`ZONES AI ADVISORY  ·  ${client?.name || ''}`, margin, 8)
        pdf.setDrawColor(74, 159, 224); pdf.setLineWidth(0.3)
        pdf.line(margin, 10, pageWidth - margin, 10)
        yPos = 16
      }
      pdf.addImage(imgData, 'PNG', margin, yPos, finalW, finalH)
      yPos += finalH + 8
    }
    return yPos
  }

  function addPageFooters(pdf, pageWidth, pageHeight, margin) {
    const total = pdf.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p)
      pdf.setFontSize(7); pdf.setTextColor(80, 110, 160)
      pdf.text(`${p} / ${total}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
      pdf.text('Confidential — Zones Innovation Center', margin, pageHeight - 8)
    }
  }

  async function exportMessageToPDF(message, messageIndex) {
    setExportingIndex(messageIndex)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210, pageHeight = 297, margin = 14, contentWidth = pageWidth - margin * 2

      makePdfHeader(pdf, pageWidth, margin)
      let yPos = 44

      // Text content
      const textContent = message.content
      if (textContent && !textContent.startsWith('{')) {
        pdf.setFontSize(11); pdf.setTextColor(30, 41, 59)
        const lines = pdf.splitTextToSize(textContent, contentWidth)
        for (const line of lines) {
          if (yPos > pageHeight - margin) { pdf.addPage(); yPos = margin + 10 }
          pdf.text(line, margin, yPos); yPos += 5
        }
        yPos += 8
      }

      // Visual captures
      const msgEl = document.querySelector(`[data-message-index="${messageIndex}"]`)
      yPos = await captureVisuals(msgEl, pdf, yPos, pageWidth, pageHeight, margin, contentWidth)

      addPageFooters(pdf, pageWidth, pageHeight, margin)

      const filename = `${(client?.name || 'Advisory').replace(/\s+/g, '-')}-Analysis-${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('Chat PDF export failed:', err)
    } finally {
      setExportingIndex(null)
    }
  }

  async function exportFullConversation() {
    setExportingIndex('all')
    try {
      const [, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210, pageHeight = 297, margin = 14, contentWidth = pageWidth - margin * 2

      // Cover page
      pdf.setFillColor(10, 22, 40)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      pdf.setFontSize(8);  pdf.setTextColor(100, 130, 180)
      pdf.text('ZONES AI ADVISORY FRAMEWORK', margin, 40)
      pdf.setFontSize(22); pdf.setTextColor(244, 246, 250)
      pdf.text(`${client?.name || 'Client'}`, margin, 56)
      pdf.setFontSize(14); pdf.setTextColor(148, 163, 184)
      pdf.text('Advisory Session Transcript', margin, 68)
      pdf.setFontSize(9);  pdf.setTextColor(100, 116, 139)
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      pdf.text(dateStr, margin, 82)
      pdf.text('Confidential — Zones Innovation Center', margin, 90)
      pdf.setDrawColor(26, 86, 168); pdf.setLineWidth(0.5)
      pdf.line(margin, 100, pageWidth - margin, 100)

      let firstContent = true
      const allMsgEls = document.querySelectorAll('[data-message-index]')

      for (const msgEl of allMsgEls) {
        const idx = parseInt(msgEl.getAttribute('data-message-index'))
        const msg = messages[idx]
        if (!msg || msg.role !== 'assistant') continue

        if (firstContent) { pdf.addPage(); firstContent = false }

        let yPos = margin + 10

        // Section label
        pdf.setFontSize(7); pdf.setTextColor(100, 130, 180)
        pdf.text(`Advisory Response ${idx}`, margin, yPos)
        pdf.setDrawColor(74, 159, 224); pdf.setLineWidth(0.2)
        pdf.line(margin, yPos + 2, pageWidth - margin, yPos + 2)
        yPos += 8

        // Text
        if (msg.content && !msg.content.startsWith('{')) {
          pdf.setFontSize(10); pdf.setTextColor(30, 41, 59)
          const lines = pdf.splitTextToSize(msg.content, contentWidth)
          for (const line of lines) {
            if (yPos > pageHeight - margin - 10) { pdf.addPage(); yPos = margin + 10 }
            pdf.text(line, margin, yPos); yPos += 4.5
          }
          yPos += 6
        }

        yPos = await captureVisuals(msgEl, pdf, yPos, pageWidth, pageHeight, margin, contentWidth)
      }

      addPageFooters(pdf, pageWidth, pageHeight, margin)

      const filename = `${(client?.name || 'Advisory').replace(/\s+/g, '-')}-Session-${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('Full conversation export failed:', err)
    } finally {
      setExportingIndex(null)
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  const hasExportableMessages = messages.some(m => m.role === 'assistant' && (m.visual || m.visuals?.length))

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
            <div key={i} className={`message ${m.role}`} data-message-index={i}>
              {m.role === 'assistant' && (
                <div className="msg-avatar"><Sparkles size={10} /></div>
              )}
              {showExpand ? (
                <div className="msg-content">
                  {m.content && <div className="msg-bubble">{m.content}</div>}
                  {!collapsedVisuals[i] && (
                    <>
                      {hasVisuals && (
                        <div className="message-visuals">
                          {m.visuals.map((v, vi) => (
                            <div key={vi} className="chat-visual-wrapper" style={{ marginTop: vi > 0 ? 12 : 0 }}>
                              <ChatVisual visual={v} />
                            </div>
                          ))}
                        </div>
                      )}
                      {m.visual && !hasVisuals && (
                        <div className="chat-visual-wrapper">
                          <ChatVisual visual={m.visual} />
                        </div>
                      )}
                    </>
                  )}
                  <button className="visual-toggle" onClick={() => toggleVisual(i)}>
                    {collapsedVisuals[i] ? 'Show visual' : 'Hide visual'}
                  </button>
                  {m.showAgentStudio && (
                    <button className="chat-action-btn" onClick={() => navigate('/agents')}>
                      <Zap size={11} /> Open Agent Studio{client?.name ? ` for ${client.name}` : ''} →
                    </button>
                  )}
                  <div className="message-actions">
                    {(m.visuals?.length >= 3) && (
                      <button
                        className="msg-expand-btn"
                        onClick={() => openInPanel(m, i)}
                        title="Open full analysis in side panel"
                      >
                        ⤢ Open full analysis
                      </button>
                    )}
                    <button
                      className="msg-export-btn"
                      onClick={() => exportMessageToPDF(m, i)}
                      disabled={exportingIndex === i}
                      title="Download as PDF"
                    >
                      {exportingIndex === i ? 'Generating…' : '↓ Export PDF'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="msg-content">
                  <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>{m.content}</div>
                  {m.showAgentStudio && (
                    <button className="chat-action-btn" onClick={() => navigate('/agents')}>
                      <Zap size={11} /> Open Agent Studio{client?.name ? ` for ${client.name}` : ''} →
                    </button>
                  )}
                  {m.role === 'assistant' && m.content && (
                    <div className="message-actions">
                      <button
                        className="msg-copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(m.content)
                          setCopiedIndex(i)
                          setTimeout(() => setCopiedIndex(null), 2000)
                        }}
                      >
                        {copiedIndex === i ? '✓ Copied' : '⎘ Copy'}
                      </button>
                    </div>
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

      {/* Export full conversation */}
      {hasExportableMessages && (
        <div className="chat-export-row">
          <button
            className="chat-export-all-btn"
            onClick={exportFullConversation}
            disabled={exportingIndex === 'all'}
          >
            {exportingIndex === 'all' ? 'Generating PDF…' : '↓ Export full conversation'}
          </button>
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

      {/* Expanded full-analysis panel */}
      {showExpandedPanel && expandedMessage && (
        <div className="expanded-panel-overlay" onClick={() => setShowExpandedPanel(false)}>
          <div className="expanded-panel" onClick={e => e.stopPropagation()}>
            <div className="expanded-panel-header">
              <div className="expanded-panel-title">{expandedMessage.title}</div>
              <button className="expanded-panel-close" onClick={() => setShowExpandedPanel(false)}>✕</button>
            </div>
            <div className="expanded-panel-body">
              {expandedMessage.reply && (
                <div className="expanded-panel-text">{expandedMessage.reply}</div>
              )}
              {expandedMessage.visuals.map((v, vi) => (
                <div key={vi} className="chat-visual-wrapper" style={{ marginTop: vi > 0 ? 16 : 0 }}>
                  <ChatVisual visual={v} />
                </div>
              ))}
            </div>
            <div className="expanded-panel-footer">
              <button
                className="msg-export-btn"
                onClick={() => exportMessageToPDF(expandedMessage.message, expandedMessage.messageIndex)}
                disabled={exportingIndex === expandedMessage.messageIndex}
              >
                {exportingIndex === expandedMessage.messageIndex ? 'Generating…' : '↓ Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
