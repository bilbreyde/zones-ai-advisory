import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ChatVisual.css'

/* ── Gantt ─────────────────────────────────────────────────────────────── */
function GanttVisual({ data }) {
  const phases = data.phases || []
  const colors = phases.map(p => p.color || '#4A9FE0')

  return (
    <div className="cv-gantt">
      <div className="cv-title">{data.title}</div>

      {/* Timeline scale header */}
      <div className="cv-gantt-scale">
        {phases.map((p, i) => (
          <div key={i} className="cv-scale-seg" style={{ borderBottom: `2px solid ${colors[i]}` }}>
            <span style={{ color: colors[i] }}>{p.days}</span>
          </div>
        ))}
      </div>

      <div className="cv-gantt-phases">
        {phases.map((phase, i) => (
          <div key={i} className="cv-phase">
            {/* Phase bar */}
            <div className="cv-phase-bar" style={{
              background: colors[i] + '1A',
              borderLeft: `3px solid ${colors[i]}`,
            }}>
              <span className="cv-phase-name" style={{ color: colors[i] }}>{phase.name}</span>
              <span className="cv-phase-days-badge" style={{ background: colors[i] + '28', color: colors[i] }}>
                {phase.days}
              </span>
            </div>
            {/* Task list */}
            <div className="cv-phase-tasks" style={{ borderLeft: `2px solid ${colors[i]}33` }}>
              {(phase.tasks || []).map((task, j) => (
                <div key={j} className="cv-task">
                  <div className="cv-task-dot" style={{ background: colors[i] }} />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Priority Matrix ───────────────────────────────────────────────────── */
const QUADRANT_META = {
  quick_win: { label: 'Quick Wins',      col: 1, row: 1, color: '#3DBA7E' },
  strategic:  { label: 'Strategic',      col: 2, row: 1, color: '#4A9FE0' },
  fill_in:    { label: 'Fill-Ins',       col: 1, row: 2, color: '#8B5CF6' },
  thankless:  { label: 'Thankless',      col: 2, row: 2, color: '#666'    },
}

function MatrixVisual({ data }) {
  const byQ = { quick_win: [], strategic: [], fill_in: [], thankless: [] }
  for (const item of (data.items || [])) {
    if (byQ[item.quadrant]) byQ[item.quadrant].push(item.label)
  }
  return (
    <div className="cv-matrix">
      <div className="cv-title">{data.title}</div>
      <div className="cv-matrix-axes">
        <div className="cv-axis-y">
          <span>High Impact</span>
          <span>Low Impact</span>
        </div>
        <div className="cv-matrix-grid">
          {Object.entries(QUADRANT_META).map(([key, meta]) => (
            <div key={key} className="cv-quadrant" style={{ gridColumn: meta.col, gridRow: meta.row }}>
              <div className="cv-quadrant-label" style={{ color: meta.color }}>{meta.label}</div>
              <div className="cv-quadrant-items">
                {byQ[key].map((label, i) => (
                  <div key={i} className="cv-matrix-item">
                    <div className="cv-matrix-dot" style={{ background: meta.color }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="cv-axis-x-label">
            <span>Low Effort</span>
            <span>High Effort</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Timeline ──────────────────────────────────────────────────────────── */
function TimelineVisual({ data }) {
  return (
    <div className="cv-timeline">
      <div className="cv-title">{data.title}</div>
      <div className="cv-timeline-track">
        <div className="cv-timeline-line" />
        {(data.milestones || []).map((m, i) => (
          <div key={i} className="cv-milestone">
            <div className="cv-milestone-node" style={{ borderColor: m.color, background: m.color + '22' }}>
              <div className="cv-milestone-dot" style={{ background: m.color }} />
            </div>
            <div className="cv-milestone-content">
              <div className="cv-milestone-date" style={{ color: m.color }}>{m.date}</div>
              <div className="cv-milestone-label">{m.label}</div>
              {m.description && <div className="cv-milestone-desc">{m.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Scorecard ─────────────────────────────────────────────────────────── */
function ScorecardVisual({ data }) {
  return (
    <div className="cv-scorecard">
      <div className="cv-title">{data.title}</div>
      <div className="cv-scorecard-header">
        <span className="cv-sc-col-label">Pillar</span>
        <span className="cv-sc-col-label">Client Score</span>
        <span className="cv-sc-col-label">Industry Benchmark</span>
        <span className="cv-sc-col-label cv-sc-col-gap">Delta</span>
      </div>
      {(data.rows || []).map((row, i) => {
        const clientVal    = Number(row.client)    || 0
        const benchVal     = Number(row.benchmark) || 0
        const delta        = clientVal - benchVal
        const deltaStr     = (delta >= 0 ? '+' : '') + delta.toFixed(1)
        const deltaColor   = delta >= 0 ? '#3DBA7E' : '#E8A838'
        const clientPct    = (clientVal / 5) * 100
        const benchPct     = (benchVal  / 5) * 100
        return (
          <div key={i} className="cv-sc-row">
            <span className="cv-sc-label">{row.label}</span>
            <div className="cv-sc-bar-cell">
              <div className="cv-sc-bar">
                <div className="cv-sc-fill cv-sc-client" style={{ width: `${clientPct}%` }} />
              </div>
              <span className="cv-sc-val">{clientVal.toFixed(1)}</span>
            </div>
            <div className="cv-sc-bar-cell">
              <div className="cv-sc-bar">
                <div className="cv-sc-fill cv-sc-bench" style={{ width: `${benchPct}%` }} />
              </div>
              <span className="cv-sc-val">{benchVal.toFixed(1)}</span>
            </div>
            <span className="cv-sc-gap" style={{ color: deltaColor }}>{deltaStr}</span>
          </div>
        )
      })}
      <div className="cv-sc-legend">
        <div className="cv-sc-legend-item"><div className="cv-sc-legend-dot" style={{ background: '#4A9FE0' }} /> Client</div>
        <div className="cv-sc-legend-item"><div className="cv-sc-legend-dot" style={{ background: 'rgba(255,255,255,0.3)' }} /> Industry Benchmark</div>
      </div>
    </div>
  )
}

/* ── Checklist ─────────────────────────────────────────────────────────── */
function ChecklistVisual({ data }) {
  const [checked, setChecked] = useState({})
  const toggle = key => setChecked(prev => ({ ...prev, [key]: !prev[key] }))

  const allItems = (data.categories || []).flatMap(c => c.items)
  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="cv-checklist">
      <div className="cv-title">{data.title}</div>
      <div className="cv-cl-progress">
        <div className="cv-cl-progress-bar">
          <div className="cv-cl-progress-fill" style={{ width: `${allItems.length ? (doneCount / allItems.length) * 100 : 0}%` }} />
        </div>
        <span className="cv-cl-progress-label">{doneCount}/{allItems.length} complete</span>
      </div>
      {(data.categories || []).map((cat, ci) => (
        <div key={ci} className="cv-cl-category">
          <div className="cv-cl-cat-header" style={{ color: cat.color }}>
            <div className="cv-cl-cat-dot" style={{ background: cat.color }} />
            {cat.name}
          </div>
          {(cat.items || []).map((item, ii) => {
            const key  = `${ci}-${ii}`
            const done = !!checked[key]
            return (
              <div key={ii} className={`cv-cl-item ${done ? 'done' : ''}`} onClick={() => toggle(key)}>
                <div className="cv-cl-checkbox" style={{ borderColor: done ? cat.color : undefined, background: done ? cat.color + '22' : undefined }}>
                  {done && (
                    <svg width="10" height="8" viewBox="0 0 10 8">
                      <polyline points="1,4 4,7 9,1" stroke={cat.color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span>{item}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ── Render helper ─────────────────────────────────────────────────────── */
function renderVisualInner(visual) {
  switch (visual.type) {
    case 'gantt':           return <GanttVisual     data={visual} />
    case 'priority_matrix': return <MatrixVisual    data={visual} />
    case 'timeline':        return <TimelineVisual  data={visual} />
    case 'scorecard':       return <ScorecardVisual data={visual} />
    case 'checklist':       return <ChecklistVisual data={visual} />
    default:
      return (
        <pre style={{ fontSize: '10px', color: 'var(--z-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
          {JSON.stringify(visual, null, 2)}
        </pre>
      )
  }
}

/* ── Modal ─────────────────────────────────────────────────────────────── */
function VisualModal({ visual, onClose }) {
  const contentRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function downloadPng() {
    if (!contentRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      backgroundColor: '#0A1628',
      useCORS: true,
    })
    const link = document.createElement('a')
    link.download = `${(visual.title || visual.type).replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return createPortal(
    <div className="cv-modal-overlay" onClick={onClose}>
      <div className="cv-modal" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-toolbar">
          <button className="cv-modal-download" onClick={downloadPng}>↓ Download PNG</button>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cv-modal-content" ref={contentRef}>
          {renderVisualInner(visual)}
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Main export ───────────────────────────────────────────────────────── */
export default function ChatVisual({ visual }) {
  const [modalOpen, setModalOpen] = useState(false)
  if (!visual?.type) return null

  return (
    <div className="cv-wrapper">
      <button className="cv-expand-btn" onClick={() => setModalOpen(true)} title="Expand to full screen">
        ⤢
      </button>
      {renderVisualInner(visual)}
      {modalOpen && <VisualModal visual={visual} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
