import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Users, ArrowRight, Loader, Download, GraduationCap, Receipt,
  AlertTriangle, CheckCircle2, FolderOpen, FilePlus2,
} from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import { SPECIALIZATION_CARDS, completionFor } from '../lib/specializationCards.js'
import './AuditExport.css'

const API = import.meta.env.VITE_API_URL || ''

const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }

// Generated documents are saved as artifacts on the Module A control they evidence
const GENERATORS = {
  'skilling-plan': {
    label: 'Skilling Plan', icon: GraduationCap, resultKey: 'plan',
    attachTo: { module: 'moduleA', control: 'control_3_2', label: 'Module A 3.2' },
  },
  'finops-checklist': {
    label: 'FinOps Checklist', icon: Receipt, resultKey: 'checklist',
    attachTo: { module: 'moduleA', control: 'control_1_1', label: 'Module A 1.1' },
  },
}

async function apiError(res) {
  return (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`
}

// The artifact of this type already saved on a control (from the current audit record), if any
function findExistingArtifact(control, type) {
  return (control?.artifacts || []).find(a => a.type === type) || null
}

function controlNumber(controlId) {
  return controlId.replace('control_', '').replace('_', '.')
}

function ProgressBar({ percent }) {
  return (
    <div className="ae-progress">
      <div className="ae-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}

function ModuleStatus({ title, controls }) {
  const done    = controls.filter(c => c.status === 'complete').length
  const percent = controls.length ? Math.round((done / controls.length) * 100) : 0
  return (
    <section className="ae-panel">
      <div className="ae-module-head">
        <div className="ae-panel-title">{title}</div>
        <div className="ae-module-pct">{controls.length ? `${percent}%` : '—'}</div>
      </div>
      <ProgressBar percent={percent} />
      {controls.length === 0 ? (
        <div className="ae-muted ae-note">Checklist for this specialization has not been added yet.</div>
      ) : (
        <ul className="ae-control-list">
          {controls.map(c => {
            const outside = c.projects.filter(p => p.outsideWindow)
            const short   = c.projects.length < c.customerCount
            return (
              <li key={c.controlId}>
                <span className="ae-mono">{controlNumber(c.controlId)}</span>
                <span className="ae-control-name">{c.name}</span>
                <span
                  className={`ae-count ${short ? 'ae-count-short' : 'ae-count-ok'}`}
                  title={`${c.projects.length} linked customer projects of ${c.customerCount} required`}
                >
                  <FolderOpen size={11} /> {c.projects.length}/{c.customerCount}
                </span>
                {outside.length > 0 && (
                  <span
                    className="ae-window-warn"
                    title={`Outside the ${c.evidenceWindowMonths}-month evidence window: ${outside.map(p => p.projectName).join(', ')}`}
                  >
                    <AlertTriangle size={11} /> {outside.length} outside window
                  </span>
                )}
                <span className={`ae-status ae-status-${c.status}`}>{STATUS_LABELS[c.status]}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function SkillingPlanCard({ plan }) {
  return (
    <div className="ae-doc">
      <div className="ae-doc-title">{plan.title}</div>
      {plan.summary && <p className="ae-doc-text">{plan.summary}</p>}
      {plan.tagaAlignment && (
        <div className="ae-taga">
          <div className="ae-taga-title"><AlertTriangle size={13} /> TAGA alignment</div>
          <div>{plan.tagaAlignment}</div>
        </div>
      )}
      {(plan.roles || []).map((r, i) => (
        <div key={i} className="ae-doc-block">
          <div className="ae-doc-sub">
            {r.role}
            <span className="ae-doc-muted">{[r.headcount, r.timeline].filter(Boolean).join(' · ')}</span>
          </div>
          {r.currentGaps?.length > 0 && (
            <>
              <div className="ae-doc-label">Skills needed</div>
              <ul className="ae-doc-list">{r.currentGaps.map((g, j) => <li key={j}>{g}</li>)}</ul>
            </>
          )}
          {r.learningPaths?.length > 0 && (
            <>
              <div className="ae-doc-label">Microsoft Learn paths</div>
              <ul className="ae-doc-list">{r.learningPaths.map((l, j) => <li key={j}>{l}</li>)}</ul>
            </>
          )}
          {r.certifications?.length > 0 && (
            <div className="ae-doc-text">Certifications: {r.certifications.join(', ')}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function FinopsChecklistCard({ checklist }) {
  const [checked, setChecked] = useState({})   // UI only — not persisted
  return (
    <div className="ae-doc">
      <div className="ae-doc-title">{checklist.title}</div>
      {checklist.summary && <p className="ae-doc-text">{checklist.summary}</p>}
      {(checklist.sections || []).map((s, i) => (
        <div key={i} className="ae-doc-block">
          <div className="ae-doc-sub">{s.domain}</div>
          {(s.items || []).map((item, j) => {
            const id = `${i}-${j}`
            return (
              <label key={id} className={`ae-check ${checked[id] ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!checked[id]}
                  onChange={() => setChecked(c => ({ ...c, [id]: !c[id] }))}
                />
                <span>
                  {item.priority && <span className={`ae-priority ae-priority-${item.priority}`}>{item.priority}</span>}
                  {item.task}
                  {item.azureTool && <span className="ae-doc-muted"> — {item.azureTool}</span>}
                  {item.evidence && <span className="ae-check-evidence">Evidence: {item.evidence}</span>}
                </span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function AuditExport() {
  const navigate   = useNavigate()
  const { client } = useClient()

  const [records, setRecords]   = useState({})   // specialization id → audit_evidence record (card percentages)
  const [specId, setSpecId]     = useState('infra-db')
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [exporting, setExporting] = useState(false)
  const [generated, setGenerated] = useState({})  // per generator: { loading, result, error, attaching, attached }

  useEffect(() => {
    if (!client) return
    fetch(`${API}/api/audit/${client.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(list => setRecords(Object.fromEntries(list.map(rec => [rec.specialization, rec]))))
      .catch(err => console.error('Audit records load failed:', err))
  }, [client?.id])

  async function loadSummary(spec) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/audit/${client.id}/export/${spec}`)
      if (!res.ok) throw new Error(await apiError(res))
      setSummary(await res.json())
    } catch (err) {
      setSummary(null)
      setError(`Could not load readiness summary: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    setSummary(null)
    setGenerated({})
    loadSummary(specId)
  }, [client?.id, specId])

  function updateGenerated(type, patch) {
    setGenerated(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }))
  }

  async function generate(type) {
    const g = GENERATORS[type]
    updateGenerated(type, { loading: true, error: '', result: null, attached: false })
    try {
      const res = await fetch(`${API}/api/audit/${client.id}/generate/${type}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ specialization: specId }),
      })
      if (!res.ok) throw new Error(await apiError(res))
      const data = await res.json()
      updateGenerated(type, { result: data[g.resultKey] })
    } catch (err) {
      updateGenerated(type, { error: `Generation failed: ${err.message}` })
    } finally {
      updateGenerated(type, { loading: false })
    }
  }

  // Save a generated document as an artifact on its control. If one of the same type is already
  // there it is replaced (PUT) rather than duplicated (POST). Reads the record's current _etag and
  // retries once on 409, the same way the Audit Readiness page saves controls.
  async function addToPackage(type) {
    const g = GENERATORS[type]
    updateGenerated(type, { attaching: true, error: '' })
    try {
      const save = async () => {
        const recRes = await fetch(`${API}/api/audit/${client.id}/${specId}`)
        if (!recRes.ok) throw new Error(await apiError(recRes))
        const record   = await recRes.json()
        const existing = findExistingArtifact(record[g.attachTo.module]?.[g.attachTo.control], type)
        const base     = `${API}/api/audit/${client.id}/${specId}/artifact`
        return fetch(existing ? `${base}/${existing.id}` : base, {
          method:  existing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            module:       g.attachTo.module,
            control:      g.attachTo.control,
            artifactType: type,
            artifactData: generated[type].result,
            _etag:        record._etag,
          }),
        })
      }
      let res = await save()
      if (res.status === 409) res = await save()
      if (res.status === 409) throw new Error('Save conflict — please try again.')
      if (!res.ok) throw new Error(await apiError(res))
      const saved = await res.json()
      setRecords(prev => ({ ...prev, [specId]: saved }))
      updateGenerated(type, { attached: true })
      loadSummary(specId)
    } catch (err) {
      updateGenerated(type, { error: `Could not add to evidence package: ${err.message}` })
    } finally {
      updateGenerated(type, { attaching: false })
    }
  }

  async function exportPackage() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/audit/${client.id}/export-docx/${specId}`, { method: 'POST' })
      if (!res.ok) throw new Error(await apiError(res))
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `AuditReadiness-${(client.name || 'Client').replace(/[^A-Za-z0-9]+/g, '-')}-${specId}-${new Date().toISOString().split('T')[0]}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  if (!client) {
    return (
      <div className="audit-export">
        <div className="no-client">
          <Users size={32} style={{ color: 'var(--z-muted)' }} />
          <h2>No client selected</h2>
          <p>Go to the Clients page and click a client to begin.</p>
          <button className="btn-primary" onClick={() => navigate('/clients')}>
            View Clients <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  const specCard   = SPECIALIZATION_CARDS.find(s => s.id === specId)
  const customers  = summary ? new Set(summary.projects.map(p => (p.customerName || '').trim().toLowerCase()).filter(Boolean)).size : 0
  const outsideAll = summary ? summary.projects.filter(p => p.evidenceWindow.status === 'outside') : []
  const isAiSpec   = ['ai-apps', 'ai-platform'].includes(specId)

  return (
    <div className="audit-export">
      <div className="page-header">
        <div>
          <div className="page-title ae-title-row"><Package size={18} /> Audit Export</div>
          <div className="page-sub">Evidence package builder for {client.name}</div>
        </div>
        {loading && (
          <div className="header-actions">
            <span className="ae-muted ae-inline"><Loader size={12} className="ae-spin" /> Loading...</span>
          </div>
        )}
      </div>

      {/* ── Section 1 — Readiness Summary ───────────────────────────────────── */}
      <div className="ae-section-label">1 · Readiness summary</div>
      <div className="ae-card-grid">
        {SPECIALIZATION_CARDS.map(spec => {
          const Icon = spec.icon
          const { percent } = completionFor(spec.id, records[spec.id])
          return (
            <button
              key={spec.id}
              className={`ae-spec-card ${spec.id === specId ? 'active' : ''}`}
              onClick={() => setSpecId(spec.id)}
            >
              <span className="ae-spec-icon"><Icon size={14} /></span>
              <span className="ae-spec-name">{spec.name}</span>
              <span className="ae-spec-pct">{percent}%</span>
              <ProgressBar percent={percent} />
            </button>
          )
        })}
      </div>

      {error && <div className="ae-banner ae-banner-error">{error}</div>}

      {specCard?.prerequisite && (
        <div className="ae-banner ae-banner-warn">
          <AlertTriangle size={14} /> <span><strong>Prerequisites Required.</strong> {specCard.prerequisite}.</span>
        </div>
      )}

      {summary && (
        <>
          <div className="ae-summary">
            <div className="ae-summary-main">
              <div className="ae-summary-pct">{summary.readiness.percentComplete}%</div>
              <div className="ae-muted">{summary.readiness.completeControls} of {summary.readiness.totalControls} controls complete</div>
            </div>
            <div className="ae-summary-stat"><span>{summary.projects.length}</span>projects registered</div>
            <div className="ae-summary-stat"><span>{customers}</span>unique customers</div>
            <div className="ae-summary-stat">
              <span>{summary.moduleB.length ? 3 : 2}</span>customers required per {summary.moduleB.length ? 'Module B' : 'Module A'} control
            </div>
            <div className={`ae-summary-stat ${outsideAll.length ? 'ae-stat-warn' : ''}`}>
              <span>{outsideAll.length}</span>outside evidence window
            </div>
          </div>

          {outsideAll.length > 0 && (
            <div className="ae-banner ae-banner-warn">
              <AlertTriangle size={14} />
              <span>
                {outsideAll.map(p => `${p.projectName} (${p.evidenceWindow.label.toLowerCase()})`).join('; ')}.
                Replace or supplement these projects before the audit.
              </span>
            </div>
          )}

          <div className="ae-columns">
            <ModuleStatus title="Module A" controls={summary.moduleA} />
            <ModuleStatus title="Module B" controls={summary.moduleB} />
          </div>

          <section className="ae-panel">
            <div className="ae-panel-title"><AlertTriangle size={14} /> Gaps ({summary.gaps.length})</div>
            {summary.gaps.length === 0 ? (
              <div className="ae-muted">No gaps — every control is complete.</div>
            ) : (
              <ul className="ae-gap-list">
                {summary.gaps.map(g => (
                  <li key={`${g.module}-${g.controlId}`}>
                    <div className="ae-gap-head">
                      <span className="ae-mono">{g.module === 'moduleA' ? 'A' : 'B'} {controlNumber(g.controlId)}</span>
                      <span className="ae-gap-name">{g.name}</span>
                      {g.skippable && <span className="ae-pill">Optional if not deployed</span>}
                      <span className={`ae-status ae-status-${g.status}`}>{STATUS_LABELS[g.status]}</span>
                    </div>
                    <div className="ae-gap-evidence">Required: {g.requiredEvidence}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* ── Section 2 — AI Generation ──────────────────────────────────────── */}
      <div className="ae-section-label">2 · AI generation</div>
      <div className="ae-generators">
        {Object.entries(GENERATORS).map(([type, g]) => {
          const state = generated[type] || {}
          const Icon  = g.icon
          return (
            <section key={type} className="ae-panel ae-generator">
              <button className="btn-outline ae-generate-btn" onClick={() => generate(type)} disabled={state.loading}>
                {state.loading ? <Loader size={13} className="ae-spin" /> : <Icon size={13} />}
                {state.result ? `Regenerate ${g.label}` : `Generate ${g.label}`}
              </button>
              {type === 'skilling-plan' && isAiSpec && !state.result && (
                <div className="ae-muted">Includes TAGA alignment for {specCard?.name}.</div>
              )}
              {state.loading && <div className="ae-muted">The AI model is drafting the {g.label.toLowerCase()}…</div>}
              {state.error && <div className="ae-error">{state.error}</div>}
              {state.result && type === 'skilling-plan'    && <SkillingPlanCard plan={state.result} />}
              {state.result && type === 'finops-checklist' && <FinopsChecklistCard checklist={state.result} />}
              {state.result && (
                state.attached ? (
                  <span className="ae-attached"><CheckCircle2 size={13} /> Added to evidence package ({g.attachTo.label})</span>
                ) : (
                  <button className="btn-primary ae-attach-btn" onClick={() => addToPackage(type)} disabled={state.attaching}>
                    {state.attaching ? <Loader size={13} className="ae-spin" /> : <FilePlus2 size={13} />}
                    Add to Evidence Package
                  </button>
                )
              )}
            </section>
          )
        })}
      </div>

      {/* ── Section 3 — Export Evidence Package ────────────────────────────── */}
      <div className="ae-section-label">3 · Export evidence package</div>
      <section className="ae-panel ae-export">
        <div>
          <div className="ae-panel-title">Word evidence package — {specCard?.name}</div>
          <div className="ae-muted">
            Cover page, executive summary, Module A and B control tables, gap analysis, customer projects and
            AI-generated next steps, plus an appendix of attached evidence.
          </div>
        </div>
        <button className="btn-primary" onClick={exportPackage} disabled={!summary || exporting}>
          {exporting ? <Loader size={13} className="ae-spin" /> : <Download size={13} />}
          {exporting ? 'Building document…' : 'Export Evidence Package'}
        </button>
      </section>
    </div>
  )
}
