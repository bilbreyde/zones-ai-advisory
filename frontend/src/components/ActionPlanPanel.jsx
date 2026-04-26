import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader, Download } from 'lucide-react'
import ChatVisual from './ChatVisual.jsx'
import './ActionPlanPanel.css'

const API = import.meta.env.VITE_API_URL || ''

export default function ActionPlanPanel({ item, client, onClose }) {
  const [isOpen,     setIsOpen]     = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [reply,      setReply]      = useState('')
  const [visuals,    setVisuals]    = useState([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const bodyRef = useRef(null)

  // Slide in after mount
  useEffect(() => {
    const t = setTimeout(() => setIsOpen(true), 10)
    return () => clearTimeout(t)
  }, [])

  // ESC to close
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fetch action plan on mount
  useEffect(() => {
    const scoresJson  = JSON.stringify(client?.scores || {})
    const timeframe   = item.period || item.timeline || 'the defined period'
    const prompt =
      `Generate a complete action plan for: "${item.title}" for ${client?.name || 'this client'}.

IMPORTANT TIMELINE CONSTRAINT: This initiative is scoped to ${timeframe}. All timeline visuals MUST align to this exact timeframe. Do not create a longer or shorter timeline than specified.

The Gantt chart phases must fit within "${timeframe}" and use the same time units as the timeframe label — if it says "Week 1-2" use weeks, if it says "Month 2" or "Month 3+" use months, if it says "30-60 days" use days. Phase names in the Gantt must mirror these labels exactly (e.g. "Week 1", "Week 2" or "Month 1", "Month 2", not generic "Phase 1", "Phase 2").

Include all of the following as structured visuals in a visuals array anchored to the ${timeframe} timeframe:
1. A Gantt chart with phases that fit within ${timeframe}, using the correct time unit
2. A RACI matrix showing who is responsible for each workstream
3. A risk heat map for risks specific to this initiative
4. Key milestones and success metrics as a checklist

Make every recommendation specific to ${client?.name}'s actual scores: ${scoresJson}. Reference their specific gaps. This should read as a bespoke consulting deliverable, not a generic template.`

    fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        clientContext: client ? {
          name: client.name,
          scores: client.scores,
          overallScore: client.overallScore,
          industry: client.industry,
          size: client.size,
        } : null,
        maxTokens: 4000,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setReply(data.reply || '')
        // Support both visuals array and single visual
        const v = data.visuals?.length ? data.visuals : data.visual ? [data.visual] : []
        setVisuals(v)
      })
      .catch(() => setReply('Failed to generate action plan. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  function handleClose() {
    setIsOpen(false)
    setTimeout(onClose, 300)
  }

  async function downloadPDF() {
    if (!bodyRef.current) return
    setPdfLoading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(bodyRef.current, {
        scale: 2,
        backgroundColor: '#0F2040',
        useCORS: true,
        scrollY: 0,
      })
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pw        = pdf.internal.pageSize.getWidth()
      const ph        = pdf.internal.pageSize.getHeight()
      const ratio     = pw / canvas.width
      const totalH    = canvas.height * ratio
      let yPos = 0
      while (yPos < totalH) {
        pdf.addImage(canvas, 'PNG', 0, -yPos, pw, totalH)
        yPos += ph
        if (yPos < totalH) pdf.addPage()
      }
      const safeTitle  = (item.title  || 'plan').replace(/[^a-z0-9]/gi, '-')
      const safeClient = (client?.name || 'client').replace(/[^a-z0-9]/gi, '-')
      pdf.save(`${safeClient}-${safeTitle}-Action-Plan.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  return createPortal(
    <>
      <div className="ap-overlay" onClick={handleClose} />
      <div className={`ap-panel${isOpen ? ' open' : ''}`}>

        {/* Header */}
        <div className="ap-header">
          <div className="ap-header-content">
            <div className="ap-title">{item.title}</div>
            <div className="ap-subtitle">
              {client?.name ?? 'Client'}
              {(item.period || item.pillar) ? ` · ${item.period || item.pillar}` : ''}
              {item.timeline ? <span className="ap-scope-badge">{item.timeline}</span> : null}
            </div>
          </div>
          <button className="ap-close" onClick={handleClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="ap-body" ref={bodyRef}>
          {loading ? (
            <div className="ap-loading">
              <Loader size={22} className="ap-spin" />
              <div className="ap-loading-text">Generating your action plan…</div>
              <div className="ap-loading-sub">
                Tailoring recommendations to {client?.name ?? 'this client'}'s assessment data
              </div>
            </div>
          ) : (
            <>
              {/* PDF cover — subtle in UI, prominent when printed */}
              <div className="plan-cover">
                <div className="plan-cover-brand">ZONES AI ADVISORY FRAMEWORK</div>
                <div className="plan-cover-title">{client?.name ?? 'Client'} — {item.title}</div>
                <div className="plan-cover-meta">
                  Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Confidential
                </div>
              </div>

              {/* Opening executive summary */}
              {reply && (
                <div className="plan-summary">
                  <div className="plan-summary-icon">📋</div>
                  <p>{reply}</p>
                </div>
              )}

              {/* Visual sections with narrative context */}
              {visuals.map((visual, i) => (
                <div key={i} className="action-plan-section">
                  {i > 0 && (
                    <div className="section-divider">
                      <span className="section-num">0{i + 1}</span>
                      <div className="divider-line" />
                    </div>
                  )}
                  {visual.narrative && (
                    <div className="narrative-block">
                      <div className="narrative-headline">{visual.narrative.headline}</div>
                      {visual.narrative.context && (
                        <p className="narrative-context">{visual.narrative.context}</p>
                      )}
                      {visual.narrative.actions?.length > 0 && (
                        <div className="narrative-callout">
                          <div className="callout-label">Key actions</div>
                          <ul>
                            {visual.narrative.actions.map((action, j) => (
                              <li key={j}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="ap-visual-section">
                    <ChatVisual visual={visual} />
                  </div>
                </div>
              ))}

              {!reply && visuals.length === 0 && (
                <p className="ap-error">No plan generated. Please try again.</p>
              )}
            </>
          )}
        </div>

        {/* Footer download */}
        {!loading && (visuals.length > 0 || reply) && (
          <div className="ap-footer">
            <button className="ap-download" onClick={downloadPDF} disabled={pdfLoading}>
              {pdfLoading
                ? <><Loader size={13} className="ap-spin" /> Generating PDF…</>
                : <><Download size={13} /> Download full plan as PDF</>}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
