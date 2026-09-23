import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, Monitor, Server, BarChart2, Brain, Cpu, Shield, Users,
  ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Info, AlertTriangle, Loader, FolderOpen,
} from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import { getControlsForSpecialization } from '../lib/controlDefinitions.js'
import './AuditReadiness.css'

const API = import.meta.env.VITE_API_URL || ''

const SPECIALIZATION_CARDS = [
  { id: 'infra-db',    name: 'Infrastructure and DB Migration', icon: Database },
  { id: 'avd',         name: 'Azure Virtual Desktop',           icon: Monitor },
  { id: 'vmware',      name: 'Azure VMware Solution',           icon: Server,
    prerequisite: 'Requires VMware Certified Professional (VCP) credential held by a full-time employee' },
  { id: 'analytics',   name: 'Analytics on Azure',              icon: BarChart2 },
  { id: 'ai-apps',     name: 'AI Applications on Azure',        icon: Brain },
  { id: 'ai-platform', name: 'AI Platform on Azure',            icon: Cpu },
]

const STATUS_ORDER  = ['not_started', 'in_progress', 'complete']
const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }

const WAIVER_NOTICE = 'A previous Module A+B Pass result within two years satisfies all Module A controls. Contact your PDM to confirm waiver eligibility before scheduling your audit.'
const TAGA_NOTICE   = 'AI Apps and AI Platform require a TAGA (Technical Assessment for Generative AI in Azure) report as part of this skilling plan. Add the TAGA output as an artifact.'

const EMPTY_CONTROL = { status: 'not_started', artifacts: [], notes: '' }

// Completion across Module A + Module B for one specialization's saved record
function completionFor(specializationId, record) {
  const { moduleA, moduleB } = getControlsForSpecialization(specializationId)
  const all = [
    ...moduleA.map(c => record?.moduleA?.[c.id]?.status),
    ...moduleB.map(c => record?.moduleB?.[c.id]?.status),
  ]
  const complete   = all.filter(s => s === 'complete').length
  const inProgress = all.filter(s => s === 'in_progress').length
  const percent    = all.length ? Math.round((complete / all.length) * 100) : 0
  const status     = percent === 100 ? 'complete'
    : (percent > 0 || inProgress > 0) ? 'in_progress'
    : 'not_started'
  return { percent, status, complete, total: all.length }
}

function applyControlPatch(record, moduleKey, controlId, patch) {
  const current = record[moduleKey]?.[controlId] || EMPTY_CONTROL
  return { ...record, [moduleKey]: { ...record[moduleKey], [controlId]: { ...current, ...patch } } }
}

function moduleCompletion(controls, moduleRecord) {
  if (!controls.length) return 0
  const done = controls.filter(c => moduleRecord?.[c.id]?.status === 'complete').length
  return Math.round((done / controls.length) * 100)
}

function StatusBadge({ status, onClick, disabled }) {
  return (
    <button
      className={`ar-status ar-status-${status}`}
      onClick={onClick}
      disabled={disabled}
      title="Click to change status"
    >
      <span className="ar-status-dot" />
      {STATUS_LABELS[status]}
    </button>
  )
}

function ProgressBar({ percent }) {
  return (
    <div className="ar-progress">
      <div className="ar-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}

function ControlCard({ control, state, specializationId, projectCount, onCycleStatus, onSaveNotes }) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes]       = useState(state.notes || '')

  // Keep the textarea in sync when the record is (re)loaded from the server
  useEffect(() => { setNotes(state.notes || '') }, [state.notes])

  const showOptional = control.skipIfNotDeployed && specializationId === 'analytics'
  const showTaga     = control.requiresTagaReport

  return (
    <div className="ar-control">
      <div className="ar-control-head">
        <div className="ar-control-title">
          <span className="ar-control-num">{control.number}</span>
          <span className="ar-control-name">{control.name}</span>
          {showOptional && <span className="ar-pill-optional">Optional for Analytics</span>}
        </div>
        <StatusBadge status={state.status} onClick={onCycleStatus} />
      </div>

      {showTaga && (
        <div className="ar-banner ar-banner-warn">
          <AlertTriangle size={14} />
          <span>{TAGA_NOTICE}</span>
        </div>
      )}

      <button className="ar-evidence-toggle" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Required evidence
        <span className="ar-evidence-meta">
          {control.customerCount} customers
          {control.evidenceWindowMonths ? ` · last ${control.evidenceWindowMonths} months` : ''}
        </span>
      </button>
      {expanded && (
        <div className="ar-evidence-body">
          {control.requiredEvidence}
          {control.notes && <div className="ar-evidence-note">{control.notes}</div>}
        </div>
      )}

      <textarea
        className="ar-notes"
        placeholder="Notes — saved when you click away"
        value={notes}
        rows={2}
        onChange={e => setNotes(e.target.value)}
        onBlur={() => { if (notes !== (state.notes || '')) onSaveNotes(notes) }}
      />

      <div className="ar-control-foot">
        <span className="ar-foot-item">
          <FolderOpen size={12} />
          {projectCount === null ? '—' : projectCount} customer project{projectCount === 1 ? '' : 's'} linked
        </span>
        {state.artifacts?.length > 0 && (
          <span className="ar-foot-item">{state.artifacts.length} artifact{state.artifacts.length === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  )
}

function ModuleSection({ title, controls, moduleKey, record, specializationId, projectCounts, banner, emptyText, onCycleStatus, onSaveNotes }) {
  const percent = moduleCompletion(controls, record?.[moduleKey])
  return (
    <section className="ar-module">
      <div className="ar-module-head">
        <div>
          <div className="ar-module-title">{title}</div>
          <div className="ar-module-sub">{controls.length} controls · {percent}% complete</div>
        </div>
        <div className="ar-module-progress"><ProgressBar percent={percent} /></div>
      </div>

      {banner}

      {controls.length === 0 ? (
        <div className="ar-empty">{emptyText}</div>
      ) : (
        <div className="ar-control-list">
          {controls.map(control => (
            <ControlCard
              key={control.id}
              control={control}
              state={record?.[moduleKey]?.[control.id] || EMPTY_CONTROL}
              specializationId={specializationId}
              projectCount={projectCounts ? (projectCounts[`${moduleKey}.${control.id}`] || 0) : null}
              onCycleStatus={() => onCycleStatus(moduleKey, control.id)}
              onSaveNotes={notes => onSaveNotes(moduleKey, control.id, notes)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function AuditReadiness() {
  const navigate   = useNavigate()
  const { client } = useClient()

  const [records, setRecords]           = useState({})   // specialization id → audit_evidence record
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError]     = useState('')

  const [selectedId, setSelectedId]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError]   = useState('')
  const [projectCounts, setProjectCounts] = useState(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [saveError, setSaveError]       = useState('')

  // Serialize writes — the backend does read-modify-write on one document per specialization
  const saveQueue = useRef(Promise.resolve())
  // Latest _etag per specialization — read when a queued save is sent, not when it is queued
  const etagRef = useRef({})
  // Changes not yet confirmed by the server — re-applied on top of fresh data after a conflict
  const pendingRef = useRef([])

  // STATE 1 — load all records for the client
  useEffect(() => {
    if (!client) return
    setSelectedId(null)
    setRecords({})
    setOverviewError('')
    setOverviewLoading(true)
    fetch(`${API}/api/audit/${client.id}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then(list => setRecords(Object.fromEntries(list.map(rec => [rec.specialization, rec]))))
      .catch(err => setOverviewError(`Could not load audit records: ${err.message}`))
      .finally(() => setOverviewLoading(false))
  }, [client?.id])

  // STATE 2 — load the selected specialization's control map and linked project counts
  useEffect(() => {
    if (!client || !selectedId) return
    setDetailError('')
    setSaveError('')
    setProjectCounts(null)
    setDetailLoading(true)

    fetch(`${API}/api/audit/${client.id}/${selectedId}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then(rec => {
        etagRef.current[selectedId] = rec._etag   // undefined until the record is first saved
        setRecords(prev => ({ ...prev, [selectedId]: rec }))
      })
      .catch(err => setDetailError(`Could not load controls: ${err.message}`))
      .finally(() => setDetailLoading(false))

    // Project counts come from the export summary; failure only hides the counts
    fetch(`${API}/api/audit/${client.id}/export/${selectedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(summary => {
        if (!summary) return
        const counts = {}
        for (const c of summary.moduleA || []) counts[`moduleA.${c.controlId}`] = c.projects?.length || 0
        for (const c of summary.moduleB || []) counts[`moduleB.${c.controlId}`] = c.projects?.length || 0
        setProjectCounts(counts)
      })
      .catch(err => console.error('Audit project counts failed:', err))
  }, [client?.id, selectedId])

  function updateControlLocally(specializationId, moduleKey, controlId, patch) {
    setRecords(prev => {
      const rec = prev[specializationId]
      if (!rec) return prev
      return { ...prev, [specializationId]: applyControlPatch(rec, moduleKey, controlId, patch) }
    })
  }

  // Show the server's record, with any other still-pending local changes layered on top
  function showServerRecord(specializationId, serverRecord, confirmedChange) {
    const stillPending = pendingRef.current.filter(c =>
      c !== confirmedChange && c.specializationId === specializationId)
    const merged = stillPending.reduce(
      (rec, c) => applyControlPatch(rec, c.moduleKey, c.controlId, c.patch), serverRecord)
    setRecords(prev => ({ ...prev, [specializationId]: merged }))
  }

  function putControl(specializationId, moduleKey, controlId, patch) {
    return fetch(`${API}/api/audit/${client.id}/${specializationId}/control`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        module: moduleKey, control: controlId, ...patch, _etag: etagRef.current[specializationId],
      }),
    })
  }

  async function fetchRecord(specializationId) {
    const res = await fetch(`${API}/api/audit/${client.id}/${specializationId}`)
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
    return res.json()
  }

  function saveControl(specializationId, moduleKey, controlId, patch, previous) {
    const change = { specializationId, moduleKey, controlId, patch }
    pendingRef.current.push(change)
    updateControlLocally(specializationId, moduleKey, controlId, patch)
    setSaveError('')
    setPendingSaves(n => n + 1)

    saveQueue.current = saveQueue.current.then(async () => {
      try {
        let res = await putControl(specializationId, moduleKey, controlId, patch)
        let retried = false

        if (res.status === 409) {
          // Record changed elsewhere — reload it and apply this change on top, once
          const fresh = await fetchRecord(specializationId)
          etagRef.current[specializationId] = fresh._etag
          res     = await putControl(specializationId, moduleKey, controlId, patch)
          retried = true

          if (res.status === 409) {
            showServerRecord(specializationId, fresh, change)
            setSaveError('Save conflict — please try again.')
            return
          }
        }

        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
        const saved = await res.json()
        etagRef.current[specializationId] = saved._etag

        if (retried) {
          // The fresh record may carry other people's changes — show them
          showServerRecord(specializationId, saved, change)
        } else {
          // Keep the server's id/_etag/updatedAt without clobbering edits made while this save was in flight
          setRecords(prev => ({
            ...prev,
            [specializationId]: {
              ...prev[specializationId], id: saved.id, _etag: saved._etag, updatedAt: saved.updatedAt,
            },
          }))
        }
      } catch (err) {
        console.error('Audit control save failed:', err)
        updateControlLocally(specializationId, moduleKey, controlId, previous)
        setSaveError(`Save failed — change reverted (${err.message})`)
      } finally {
        pendingRef.current = pendingRef.current.filter(c => c !== change)
        setPendingSaves(n => n - 1)
      }
    })
  }

  function cycleStatus(moduleKey, controlId) {
    const current = records[selectedId]?.[moduleKey]?.[controlId]?.status || 'not_started'
    const next    = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length]
    saveControl(selectedId, moduleKey, controlId, { status: next }, { status: current })
  }

  function saveNotes(moduleKey, controlId, notes) {
    const previous = records[selectedId]?.[moduleKey]?.[controlId]?.notes || ''
    saveControl(selectedId, moduleKey, controlId, { notes }, { notes: previous })
  }

  if (!client) {
    return (
      <div className="audit-readiness">
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

  // ── STATE 2 — Control Map ──────────────────────────────────────────────────
  if (selectedId) {
    const card     = SPECIALIZATION_CARDS.find(s => s.id === selectedId)
    const Icon     = card.icon
    const record   = records[selectedId]
    const controls = getControlsForSpecialization(selectedId)
    const overall  = completionFor(selectedId, record)

    return (
      <div className="audit-readiness">
        <div className="page-header">
          <div>
            <button className="btn-outline ar-back" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={13} /> All specializations
            </button>
            <div className="ar-detail-title">
              <span className="ar-card-icon"><Icon size={18} /></span>
              <div>
                <div className="page-title">{card.name}</div>
                <div className="page-sub">
                  {client.name} · {overall.complete} of {overall.total} controls complete
                </div>
              </div>
            </div>
          </div>
          <div className="header-actions">
            {pendingSaves > 0 && (
              <span className="ar-saving"><Loader size={12} className="ar-spin" /> Saving...</span>
            )}
            <div className="ar-overall">
              <div className="ar-overall-pct">{overall.percent}%</div>
              <ProgressBar percent={overall.percent} />
            </div>
          </div>
        </div>

        {card.prerequisite && (
          <div className="ar-banner ar-banner-warn">
            <AlertTriangle size={14} />
            <span><strong>Prerequisites Required.</strong> {card.prerequisite}.</span>
          </div>
        )}

        {saveError   && <div className="ar-banner ar-banner-error">{saveError}</div>}
        {detailError && <div className="ar-banner ar-banner-error">{detailError}</div>}

        {detailLoading && !record ? (
          <div className="ar-loading"><Loader size={16} className="ar-spin" /> Loading controls...</div>
        ) : record && (
          <>
            <ModuleSection
              title="Module A"
              controls={controls.moduleA}
              moduleKey="moduleA"
              record={record}
              specializationId={selectedId}
              projectCounts={projectCounts}
              banner={(
                <div className="ar-banner ar-banner-info">
                  <Info size={14} />
                  <span>{WAIVER_NOTICE}</span>
                </div>
              )}
              onCycleStatus={cycleStatus}
              onSaveNotes={saveNotes}
            />
            <ModuleSection
              title="Module B"
              controls={controls.moduleB}
              moduleKey="moduleB"
              record={record}
              specializationId={selectedId}
              projectCounts={projectCounts}
              emptyText="Module B checklist for this specialization has not been added yet."
              onCycleStatus={cycleStatus}
              onSaveNotes={saveNotes}
            />
          </>
        )}
      </div>
    )
  }

  // ── STATE 1 — Specialization Overview ──────────────────────────────────────
  return (
    <div className="audit-readiness">
      <div className="page-header">
        <div>
          <div className="page-title ar-title-row"><Shield size={18} /> Audit Readiness</div>
          <div className="page-sub">Azure Specialization audit controls for {client.name}</div>
        </div>
        {overviewLoading && (
          <div className="header-actions">
            <span className="ar-saving"><Loader size={12} className="ar-spin" /> Loading...</span>
          </div>
        )}
      </div>

      {overviewError && <div className="ar-banner ar-banner-error">{overviewError}</div>}

      <div className="ar-grid">
        {SPECIALIZATION_CARDS.map(spec => {
          const Icon = spec.icon
          const { percent, status } = completionFor(spec.id, records[spec.id])
          return (
            <button key={spec.id} className="ar-card" onClick={() => setSelectedId(spec.id)}>
              <div className="ar-card-top">
                <span className="ar-card-icon"><Icon size={18} /></span>
                {spec.prerequisite && (
                  <span className="ar-prereq">
                    Prerequisites Required
                    <span className="ar-tooltip" role="tooltip">{spec.prerequisite}</span>
                  </span>
                )}
              </div>
              <div className="ar-card-name">{spec.name}</div>
              <div className="ar-card-stats">
                <span className="ar-card-pct">{percent}%</span>
                <span className={`ar-card-status ar-text-${status}`}>{STATUS_LABELS[status]}</span>
              </div>
              <div className="ar-card-foot"><ProgressBar percent={percent} /></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
