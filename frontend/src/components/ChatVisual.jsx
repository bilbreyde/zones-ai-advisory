import { useState } from 'react'
import './ChatVisual.css'

/* ── Gantt ─────────────────────────────────────────────────────────────── */
function GanttVisual({ data }) {
  const colors = data.phases?.map(p => p.color) || ['#E8A838', '#4A9FE0', '#3DBA7E']
  return (
    <div className="cv-gantt">
      <div className="cv-title">{data.title}</div>
      <div className="cv-gantt-phases">
        {(data.phases || []).map((phase, i) => (
          <div key={i} className="cv-phase">
            <div className="cv-phase-header" style={{ borderColor: colors[i] }}>
              <div className="cv-phase-bar" style={{ background: colors[i] + '22', borderLeft: `3px solid ${colors[i]}` }}>
                <span className="cv-phase-name" style={{ color: colors[i] }}>{phase.name}</span>
                <span className="cv-phase-days">{phase.days}</span>
              </div>
            </div>
            <div className="cv-phase-tasks">
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
  quick_win:  { label: 'Quick Wins',       col: 1, row: 1, color: '#3DBA7E' },
  strategic:  { label: 'Strategic',        col: 2, row: 1, color: '#4A9FE0' },
  fill_in:    { label: 'Fill-Ins',         col: 1, row: 2, color: '#8B5CF6' },
  thankless:  { label: 'Thankless Tasks',  col: 2, row: 2, color: '#666' },
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
  const maxVal = 5
  return (
    <div className="cv-scorecard">
      <div className="cv-title">{data.title}</div>
      <div className="cv-scorecard-header">
        <span className="cv-sc-col-label">Pillar</span>
        <span className="cv-sc-col-label">Client</span>
        <span className="cv-sc-col-label">Benchmark</span>
        <span className="cv-sc-col-label cv-sc-col-gap">Gap</span>
      </div>
      {(data.rows || []).map((row, i) => {
        const gap = (row.client - row.benchmark).toFixed(1)
        const gapNum = parseFloat(gap)
        const gapColor = gapNum >= 0 ? '#3DBA7E' : '#E8A838'
        const clientPct = (row.client / maxVal) * 100
        const benchPct  = (row.benchmark / maxVal) * 100
        return (
          <div key={i} className="cv-sc-row">
            <span className="cv-sc-label">{row.label}</span>
            <div className="cv-sc-bar-cell">
              <div className="cv-sc-bar">
                <div className="cv-sc-fill cv-sc-client" style={{ width: `${clientPct}%` }} />
                <div className="cv-sc-bench-marker" style={{ left: `${benchPct}%` }} />
              </div>
              <span className="cv-sc-val">{row.client}</span>
            </div>
            <span className="cv-sc-val cv-sc-bench-val">{row.benchmark}</span>
            <span className="cv-sc-gap" style={{ color: gapColor }}>
              {gapNum >= 0 ? '+' : ''}{gap}
            </span>
          </div>
        )
      })}
      <div className="cv-sc-legend">
        <div className="cv-sc-legend-item"><div className="cv-sc-legend-dot" style={{ background: '#4A9FE0' }} /> Client</div>
        <div className="cv-sc-legend-item"><div className="cv-sc-legend-bench" /> Industry Benchmark</div>
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
            const key = `${ci}-${ii}`
            const done = !!checked[key]
            return (
              <div key={ii} className={`cv-cl-item ${done ? 'done' : ''}`} onClick={() => toggle(key)}>
                <div className="cv-cl-checkbox" style={{ borderColor: done ? cat.color : undefined, background: done ? cat.color + '22' : undefined }}>
                  {done && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" stroke={cat.color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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

/* ── Main export ───────────────────────────────────────────────────────── */
export default function ChatVisual({ visual }) {
  if (!visual?.type) return null
  switch (visual.type) {
    case 'gantt':           return <GanttVisual    data={visual} />
    case 'priority_matrix': return <MatrixVisual   data={visual} />
    case 'timeline':        return <TimelineVisual data={visual} />
    case 'scorecard':       return <ScorecardVisual data={visual} />
    case 'checklist':       return <ChecklistVisual data={visual} />
    default:                return null
  }
}
