import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader, Download } from 'lucide-react'
import ChatVisual from './ChatVisual.jsx'
import './ActionPlanPanel.css'

const API = import.meta.env.VITE_API_URL || ''

export default function ActionPlanPanel({ item, client, onClose }) {
  const [isOpen,      setIsOpen]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [reply,       setReply]       = useState('')
  const [visuals,     setVisuals]     = useState([])
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const panelContentRef = useRef(null)

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
    const scoresJson = JSON.stringify(client?.scores || {})
    const timeframe  = item.period || item.timeline || 'the defined period'
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
          name:         client.name,
          scores:       client.scores,
          overallScore: client.overallScore,
          industry:     client.industry,
          size:         client.size,
        } : null,
        maxTokens: 4000,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setReply(data.reply || '')
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
    setPdfLoading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const PAGE_W  = 210   // A4 mm
      const PAGE_H  = 297
      const MARGIN  = 14
      const CONTENT_W = PAGE_W - MARGIN * 2

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      // ── Cover page (drawn with jsPDF, no screenshot) ──────────────────
      pdf.setFillColor(10, 22, 40)
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')

      pdf.setFontSize(7)
      pdf.setTextColor(100, 130, 180)
      pdf.text('ZONES AI ADVISORY FRAMEWORK', MARGIN, MARGIN + 4)

      pdf.setFontSize(16)
      pdf.setTextColor(244, 246, 250)
      pdf.text(
        `${client?.name || 'Client'} — ${item?.title || 'Action Plan'}`,
        MARGIN, MARGIN + 16,
        { maxWidth: CONTENT_W }
      )

      pdf.setFontSize(8)
      pdf.setTextColor(120, 150, 190)
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      pdf.text(`Generated ${dateStr}  ·  Confidential`, MARGIN, MARGIN + 26)

      pdf.setDrawColor(74, 159, 224)
      pdf.setLineWidth(0.5)
      pdf.line(MARGIN, MARGIN + 32, PAGE_W - MARGIN, MARGIN + 32)

      // Scope/timeframe
      const timeframe = item.period || item.timeline
      if (timeframe) {
        pdf.setFontSize(9)
        pdf.setTextColor(74, 159, 224)
        pdf.text(`Scope: ${timeframe}`, MARGIN, MARGIN + 42)
      }

      // ── Helper: add one captured element to the PDF ───────────────────
      let yPos = MARGIN  // tracks position on current page (page 2+)

      function addPageHeader() {
        pdf.setFontSize(7)
        pdf.setTextColor(100, 130, 180)
        const label = `ZONES AI ADVISORY FRAMEWORK  ·  ${client?.name || ''}  ·  ${item?.title || ''}`
        pdf.text(label, MARGIN, 8)
        pdf.setDrawColor(74, 159, 224)
        pdf.setLineWidth(0.3)
        pdf.line(MARGIN, 10, PAGE_W - MARGIN, 10)
        yPos = 16
      }

      async function addElement(el) {
        if (!el) return
        // Scroll element into view so it renders fully before capture
        el.scrollIntoView({ block: 'nearest' })
        await new Promise(r => setTimeout(r, 120))

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0F2040',
          logging: false,
          windowWidth:  el.scrollWidth,
          windowHeight: el.scrollHeight,
        })

        const imgData   = canvas.toDataURL('image/png')
        const rawH      = (canvas.height / canvas.width) * CONTENT_W
        // Never let a single element exceed one full page
        const maxH      = PAGE_H - MARGIN * 2 - 6
        const imgH      = Math.min(rawH, maxH)
        const imgW      = rawH > maxH ? CONTENT_W * (maxH / rawH) : CONTENT_W

        // New page if element doesn't fit
        if (yPos + imgH > PAGE_H - MARGIN) {
          pdf.addPage()
          pdf.setFillColor(10, 22, 40)
          pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
          addPageHeader()
        }

        pdf.addImage(imgData, 'PNG', MARGIN, yPos, imgW, imgH)
        yPos += imgH + 5
      }

      // ── Page 2 onwards: capture each section element ──────────────────
      pdf.addPage()
      pdf.setFillColor(10, 22, 40)
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
      addPageHeader()

      const container = panelContentRef.current
      if (container) {
        // Executive summary card
        const summaryEl = container.querySelector('.plan-summary')
        if (summaryEl) await addElement(summaryEl)

        // Each action plan section: narrative then visual, separately
        const sections = container.querySelectorAll('.action-plan-section')
        for (const section of sections) {
          const narrativeEl = section.querySelector('.narrative-block')
          const visualEl    = section.querySelector('.chat-visual-wrapper')
          if (narrativeEl) await addElement(narrativeEl)
          if (visualEl)    await addElement(visualEl)
          yPos += 3 // breathing room between sections
        }
      }

      // ── Footer on every page ──────────────────────────────────────────
      const totalPages = pdf.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p)
        pdf.setFontSize(7)
        pdf.setTextColor(80, 110, 160)
        pdf.text(`${p} / ${totalPages}`, PAGE_W / 2, PAGE_H - 6, { align: 'center' })
        pdf.text('Confidential — Zones Innovation Center', MARGIN, PAGE_H - 6)
      }

      const safeClient = (client?.name  || 'Client').replace(/[^a-z0-9]/gi, '-')
      const safeTitle  = (item?.title   || 'Action-Plan').replace(/[^a-z0-9]/gi, '-')
      pdf.save(`${safeClient}-${safeTitle}-Action-Plan.pdf`)

    } catch (err) {
      console.error('PDF export failed:', err)
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
        <div className="ap-body" ref={panelContentRef}>
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
                  <div className="chat-visual-wrapper ap-visual-section">
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
