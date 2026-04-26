import { useState, useRef, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import './ChatVisual.css'

/* ── Gantt ─────────────────────────────────────────────────────────────── */
function GanttVisual({ data }) {
  const phases = data.phases || []
  const colors = phases.map(p => p.color || '#4A9FE0')
  return (
    <div className="cv-gantt">
      <div className="cv-title">{data.title}</div>
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
            <div className="cv-phase-bar" style={{ background: colors[i] + '1A', borderLeft: `3px solid ${colors[i]}` }}>
              <span className="cv-phase-name" style={{ color: colors[i] }}>{phase.name}</span>
              <span className="cv-phase-days-badge" style={{ background: colors[i] + '28', color: colors[i] }}>{phase.days}</span>
            </div>
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
  quick_win: { label: 'Quick Wins', col: 1, row: 1, color: '#3DBA7E' },
  strategic:  { label: 'Strategic', col: 2, row: 1, color: '#4A9FE0' },
  fill_in:    { label: 'Fill-Ins',  col: 1, row: 2, color: '#8B5CF6' },
  thankless:  { label: 'Thankless', col: 2, row: 2, color: '#666'    },
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
        <div className="cv-axis-y"><span>High Impact</span><span>Low Impact</span></div>
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
          <div className="cv-axis-x-label"><span>Low Effort</span><span>High Effort</span></div>
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
        const clientVal  = Number(row.client)    || 0
        const benchVal   = Number(row.benchmark) || 0
        const delta      = clientVal - benchVal
        const deltaColor = delta >= 0 ? '#3DBA7E' : '#E8A838'
        return (
          <div key={i} className="cv-sc-row">
            <span className="cv-sc-label">{row.label}</span>
            <div className="cv-sc-bar-cell">
              <div className="cv-sc-bar">
                <div className="cv-sc-fill cv-sc-client" style={{ width: `${(clientVal / 5) * 100}%` }} />
              </div>
              <span className="cv-sc-val">{clientVal.toFixed(1)}</span>
            </div>
            <div className="cv-sc-bar-cell">
              <div className="cv-sc-bar">
                <div className="cv-sc-fill cv-sc-bench" style={{ width: `${(benchVal / 5) * 100}%` }} />
              </div>
              <span className="cv-sc-val">{benchVal.toFixed(1)}</span>
            </div>
            <span className="cv-sc-gap" style={{ color: deltaColor }}>
              {(delta >= 0 ? '+' : '') + delta.toFixed(1)}
            </span>
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
  const allItems  = (data.categories || []).flatMap(c => c.items)
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

/* ── Reference Architecture ────────────────────────────────────────────── */
function ReferenceArchitectureVisual({ data }) {
  const layers = data.layers || []
  return (
    <div className="cv-refarch">
      <div className="cv-title">{data.title}</div>
      <div className="cv-refarch-layers">
        {layers.map((layer, i) => (
          <div key={i}>
            <div className="cv-refarch-layer" style={{
              background: layer.color + '18',
              borderLeft: `3px solid ${layer.color}`,
            }}>
              <div className="cv-refarch-layer-name" style={{ color: layer.color }}>
                {layer.name.toUpperCase()}
              </div>
              <div className="cv-refarch-components">
                {(layer.components || []).map((comp, j) => (
                  <span key={j} className="cv-refarch-pill" style={{
                    background: layer.color + '20',
                    color: layer.color,
                    border: `1px solid ${layer.color}44`,
                  }}>
                    {comp}
                  </span>
                ))}
              </div>
            </div>
            {i < layers.length - 1 && (
              <div className="cv-refarch-arrow">▼</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Maturity Journey ──────────────────────────────────────────────────── */
const PILLAR_COLORS = ['#4A9FE0', '#E8A838', '#8B5CF6', '#3DBA7E', '#EC4899']
const JOURNEY_COLS = [
  { key: 'current',    label: 'Today',    today: true  },
  { key: 'target_6m',  label: '6 mo',    today: false },
  { key: 'target_12m', label: '12 mo',   today: false },
  { key: 'target_24m', label: '24 mo',   today: false },
]

function MaturityJourneyVisual({ data }) {
  const pillars = data.pillars || []
  return (
    <div className="cv-journey">
      <div className="cv-title">{data.title}</div>
      {/* Column headers — use same flex layout as track so columns align */}
      <div className="cv-journey-header">
        <div className="cv-journey-name-cell" />
        <div className="cv-journey-cols-header">
          {JOURNEY_COLS.map((col, i) => (
            <div key={i} className={`cv-journey-col-header${col.today ? ' today' : ''}`}>
              {col.label}
            </div>
          ))}
        </div>
      </div>
      {/* Pillar rows */}
      {pillars.map((pillar, pi) => {
        const color  = PILLAR_COLORS[pi % PILLAR_COLORS.length]
        const values = JOURNEY_COLS.map(col => pillar[col.key])
        return (
          <div key={pi} className="cv-journey-row">
            <div className="cv-journey-name-cell">
              <div className="cv-journey-pillar-dot" style={{ background: color }} />
              <span className="cv-journey-pillar-label" style={{ color }}>{pillar.name}</span>
            </div>
            <div className="cv-journey-track">
              {/* SVG connecting line — spans from first to last dot center */}
              <svg className="cv-journey-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="50" x2="100" y2="50"
                  stroke={color} strokeWidth="3" opacity="0.3"
                  vectorEffect="non-scaling-stroke" />
              </svg>
              {values.map((val, vi) => (
                <div key={vi} className={`cv-journey-dot${vi === 0 ? ' today' : ''}`} style={{
                  border: `2px solid ${color}`,
                  background: vi === 0 ? color : 'var(--z-bg, #0A1628)',
                  color: vi === 0 ? '#fff' : color,
                }}>
                  {val ?? '—'}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div className="cv-journey-legend">
        <div className="cv-journey-legend-item">
          <div className="cv-journey-legend-filled" style={{ background: '#4A9FE0' }} />
          <span>Current state</span>
        </div>
        <div className="cv-journey-legend-item">
          <div className="cv-journey-legend-outlined" style={{ border: '2px solid #4A9FE0' }} />
          <span>Target state</span>
        </div>
      </div>
    </div>
  )
}

/* ── RACI Matrix ───────────────────────────────────────────────────────── */
const RACI_STYLE = {
  R: { bg: 'rgba(74,159,224,0.18)',  border: 'rgba(74,159,224,0.5)',  color: '#4A9FE0' },
  A: { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.5)', color: '#8B5CF6' },
  C: { bg: 'rgba(232,168,56,0.18)', border: 'rgba(232,168,56,0.5)', color: '#E8A838' },
  I: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', color: 'rgba(244,246,250,0.4)' },
}
const RACI_LABELS = { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' }

function RaciMatrixVisual({ data }) {
  const roles = data.roles || []
  const items = data.items || []
  // grid: 1fr activity + N×44px badge columns
  const gridCols = `1fr ${roles.map(() => '44px').join(' ')}`
  return (
    <div className="cv-raci">
      <div className="cv-title">{data.title}</div>
      <div className="cv-raci-table" style={{ gridTemplateColumns: gridCols }}>
        {/* Header row */}
        <div className="cv-raci-cell cv-raci-corner" />
        {roles.map((role, i) => (
          <div key={i} className="cv-raci-cell cv-raci-role-header" title={role}>
            {role.split(' ')[0]}
          </div>
        ))}
        {/* Activity rows — Fragment so cells are direct grid children */}
        {items.map((item, ri) => (
          <Fragment key={ri}>
            <div className={`cv-raci-cell cv-raci-activity${ri % 2 === 1 ? ' alt' : ''}`}>
              {item.activity}
            </div>
            {(item.assignments || []).map((letter, ci) => {
              const s = RACI_STYLE[letter] || RACI_STYLE.I
              return (
                <div key={ci} className={`cv-raci-cell cv-raci-badge-cell${ri % 2 === 1 ? ' alt' : ''}`}>
                  <div className="cv-raci-badge" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                    {letter}
                  </div>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="cv-raci-legend">
        {Object.entries(RACI_LABELS).map(([letter, label]) => {
          const s = RACI_STYLE[letter]
          return (
            <div key={letter} className="cv-raci-legend-item">
              <div className="cv-raci-badge cv-raci-badge-sm" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                {letter}
              </div>
              <span>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Risk Heatmap ──────────────────────────────────────────────────────── */
function RiskHeatmapVisual({ data }) {
  const risks = data.risks || []
  const ML = 46, MT = 18, CW = 36, CH = 30
  const GW = 5 * CW   // 180
  const GH = 5 * CH   // 150
  const SVG_W = ML + GW + 135
  const SVG_H = MT + GH + 32

  function cellFill(col, row) {
    const impact     = col + 1
    const likelihood = 5 - row
    if (impact >= 4 && likelihood >= 4) return 'rgba(224,90,78,0.28)'
    if (impact >= 3 && likelihood >= 3) return 'rgba(232,168,56,0.18)'
    if (impact <= 2 && likelihood <= 2) return 'rgba(61,186,126,0.14)'
    return 'rgba(255,255,255,0.03)'
  }

  // Offset overlapping risks so labels don't pile up
  const seen = {}
  const positioned = risks.map(risk => {
    const col = Math.max(0, Math.min(4, (risk.impact      || 1) - 1))
    const row = Math.max(0, Math.min(4, 5 - (risk.likelihood || 1)))
    const key = `${col}-${row}`
    const n   = seen[key] = (seen[key] || 0) + 1
    const slot = n - 1
    const offsets = [[0,0],[8,-6],[-8,-6],[0,8],[8,8]]
    const [dx, dy] = offsets[slot] || [slot * 4, slot * 4]
    return { ...risk, cx: ML + col * CW + CW / 2 + dx, cy: MT + row * CH + CH / 2 + dy }
  })

  return (
    <div className="cv-heatmap">
      <div className="cv-title">{data.title}</div>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
        {/* Grid cells */}
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => (
            <rect key={`${row}-${col}`}
              x={ML + col * CW} y={MT + row * CH}
              width={CW} height={CH}
              fill={cellFill(col, row)}
              stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
            />
          ))
        )}
        {/* Y-axis values */}
        {[1,2,3,4,5].map(v => (
          <text key={v} x={ML - 6} y={MT + (5 - v) * CH + CH / 2 + 4}
            textAnchor="end" fontSize="9" fill="rgba(244,246,250,0.45)">{v}</text>
        ))}
        {/* X-axis values */}
        {[1,2,3,4,5].map(v => (
          <text key={v} x={ML + (v - 1) * CW + CW / 2} y={MT + GH + 14}
            textAnchor="middle" fontSize="9" fill="rgba(244,246,250,0.45)">{v}</text>
        ))}
        {/* Axis titles */}
        <text x={ML + GW / 2} y={SVG_H - 2} textAnchor="middle" fontSize="9" fill="rgba(244,246,250,0.38)">
          Impact →
        </text>
        <text x={9} y={MT + GH / 2} textAnchor="middle" fontSize="9" fill="rgba(244,246,250,0.38)"
          transform={`rotate(-90, 9, ${MT + GH / 2})`}>
          Likelihood →
        </text>
        {/* Corner annotations */}
        <text x={ML + GW - 3} y={MT + 10} textAnchor="end" fontSize="7.5" fontWeight="600" fill="rgba(224,90,78,0.7)">HIGH RISK</text>
        <text x={ML + 3} y={MT + GH - 5} fontSize="7.5" fontWeight="600" fill="rgba(61,186,126,0.7)">LOW RISK</text>
        <text x={ML + 3} y={MT + 10} fontSize="7.5" fill="rgba(244,246,250,0.28)">Monitor</text>
        <text x={ML + GW - 3} y={MT + GH - 5} textAnchor="end" fontSize="7.5" fill="rgba(244,246,250,0.28)">Mitigate</text>
        {/* Risk dots + labels */}
        {positioned.map((risk, i) => (
          <g key={i}>
            <circle cx={risk.cx} cy={risk.cy} r="5.5" fill="#4A9FE0" opacity="0.9" />
            <circle cx={risk.cx} cy={risk.cy} r="5.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <text x={risk.cx + 9} y={risk.cy + 4} fontSize="8.5" fill="rgba(244,246,250,0.85)">
              {risk.label.length > 22 ? risk.label.slice(0, 21) + '…' : risk.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── Process Flow ──────────────────────────────────────────────────────── */
function ProcessFlowVisual({ data }) {
  const steps = data.steps || []
  return (
    <div className="cv-flow">
      <div className="cv-title">{data.title}</div>
      <div className="cv-flow-steps">
        {steps.map((step, i) => (
          <div key={i} className="cv-flow-item">
            <div className="cv-flow-step" style={{
              background: step.color + '1A',
              borderLeft: `3px solid ${step.color}`,
            }}>
              <div className="cv-flow-step-num" style={{ color: step.color }}>{i + 1}</div>
              <div className="cv-flow-step-body">
                <div className="cv-flow-step-label" style={{ color: step.color }}>{step.label}</div>
                {step.description && <div className="cv-flow-step-desc">{step.description}</div>}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="cv-flow-arrow">
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <line x1="2" y1="7" x2="14" y2="7" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round" />
                  <polyline points="10,3 14,7 10,11" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Render helper ─────────────────────────────────────────────────────── */
function renderVisualInner(visual) {
  switch (visual.type) {
    case 'gantt':                  return <GanttVisual                 data={visual} />
    case 'priority_matrix':        return <MatrixVisual                data={visual} />
    case 'timeline':               return <TimelineVisual              data={visual} />
    case 'scorecard':              return <ScorecardVisual             data={visual} />
    case 'checklist':              return <ChecklistVisual             data={visual} />
    case 'reference_architecture': return <ReferenceArchitectureVisual data={visual} />
    case 'maturity_journey':       return <MaturityJourneyVisual       data={visual} />
    case 'raci_matrix':            return <RaciMatrixVisual            data={visual} />
    case 'risk_heatmap':           return <RiskHeatmapVisual           data={visual} />
    case 'process_flow':           return <ProcessFlowVisual           data={visual} />
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
      scale: 2, backgroundColor: '#0A1628', useCORS: true,
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
      <button className="cv-expand-btn" onClick={() => setModalOpen(true)} title="Expand to full screen">⤢</button>
      {renderVisualInner(visual)}
      {modalOpen && <VisualModal visual={visual} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
