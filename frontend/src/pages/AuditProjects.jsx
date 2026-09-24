import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpen, Plus, X, Pencil, Trash2, Users, ArrowRight, Loader,
  CheckCircle2, Clock, Link as LinkIcon, AlertTriangle, CalendarDays, Building2,
} from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import {
  SPECIALIZATIONS, MODULE_A_CONTROLS, MODULE_B_CONTROLS, controlKey, parseControlKey,
} from '../lib/controlDefinitions.js'
import './AuditProjects.css'

const API = import.meta.env.VITE_API_URL || ''

const SPEC_NAMES = Object.fromEntries(SPECIALIZATIONS.map(s => [s.id, s.name]))
const SPEC_SHORT = {
  'infra-db': 'Infra-DB', avd: 'AVD', vmware: 'AVS',
  analytics: 'Analytics', 'ai-apps': 'AI Apps', 'ai-platform': 'AI Platform',
}

const EMPTY_FORM = {
  projectName: '', customerName: '', goLiveDate: '',
  specializations: [], controlsEvidenced: [],
  customerSignOff: false, signOffDocument: '',
  artifacts: [], notes: '',
}

async function apiError(res) {
  return (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`
}

function monthsSince(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

function formatDate(dateStr) {
  if (!dateStr) return 'No go-live date'
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// "infra-db:moduleB:control_1_1" → { spec, module: 'B', number: '1.1', name }
function describeControl(key) {
  const { specializationId, moduleKey, controlId } = parseControlKey(key)
  const list = moduleKey === 'moduleA' ? MODULE_A_CONTROLS : (MODULE_B_CONTROLS[specializationId] || [])
  const c    = list.find(x => x.id === controlId)
  return {
    spec:   specializationId,
    module: moduleKey === 'moduleA' ? 'A' : 'B',
    number: c?.number || (controlId || '').replace('control_', '').replace('_', '.'),
    name:   c?.name || '',
  }
}

function ProjectModal({ initial, onClose, onSave }) {
  const [form, setForm]         = useState(initial ? { ...EMPTY_FORM, ...initial, goLiveDate: (initial.goLiveDate || '').slice(0, 10) } : EMPTY_FORM)
  const [artifactName, setArtifactName] = useState('')
  const [artifactUrl, setArtifactUrl]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  function toggleSpecialization(id) {
    setForm(f => {
      const removing        = f.specializations.includes(id)
      const specializations = removing ? f.specializations.filter(s => s !== id) : [...f.specializations, id]
      // Deselecting a specialization drops its control links
      const controlsEvidenced = removing
        ? f.controlsEvidenced.filter(k => parseControlKey(k).specializationId !== id)
        : f.controlsEvidenced
      return { ...f, specializations, controlsEvidenced }
    })
  }

  function toggleControl(key) {
    setForm(f => ({
      ...f,
      controlsEvidenced: f.controlsEvidenced.includes(key)
        ? f.controlsEvidenced.filter(k => k !== key)
        : [...f.controlsEvidenced, key],
    }))
  }

  function addArtifact() {
    if (!artifactUrl.trim()) return
    set('artifacts', [...form.artifacts, { type: 'link', name: artifactName.trim() || artifactUrl.trim(), url: artifactUrl.trim() }])
    setArtifactName('')
    setArtifactUrl('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.projectName.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  function renderCheckbox(spec, moduleKey, control) {
    const key = controlKey(spec, moduleKey, control.id)
    return (
      <label key={key} className="ap-check">
        <input type="checkbox" checked={form.controlsEvidenced.includes(key)} onChange={() => toggleControl(key)} />
        <span className="ap-check-num">{control.number}</span> {control.name}
      </label>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ap-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{initial ? 'Edit Project' : 'Add Project'}</div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <form className="modal-form ap-modal-form" onSubmit={submit}>
          <div className="form-row-2">
            <div className="form-row">
              <label>Project name *</label>
              <input value={form.projectName} onChange={e => set('projectName', e.target.value)} placeholder="e.g. SQL estate migration" autoFocus />
            </div>
            <div className="form-row">
              <label>Customer name</label>
              <input value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="End customer" />
            </div>
          </div>

          <div className="form-row ap-date-row">
            <label>Go-live date</label>
            <input type="date" value={form.goLiveDate} onChange={e => set('goLiveDate', e.target.value)} />
          </div>

          <div className="form-row">
            <label>Specializations</label>
            <div className="ap-chip-row">
              {SPECIALIZATIONS.map(s => (
                <button
                  type="button"
                  key={s.id}
                  className={`ap-chip ${form.specializations.includes(s.id) ? 'selected' : ''}`}
                  onClick={() => toggleSpecialization(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Controls evidenced</label>
            <div className="ap-control-picker">
              {form.specializations.length === 0 && (
                <div className="ap-picker-hint">Select a specialization to choose the controls this project evidences.</div>
              )}
              {form.specializations.map(spec => (
                <div key={spec} className="ap-picker-spec">
                  <div className="ap-picker-spec-title">{SPEC_NAMES[spec]}</div>
                  <div className="ap-picker-group">
                    <div className="ap-picker-title">Module A</div>
                    {MODULE_A_CONTROLS.map(c => renderCheckbox(spec, 'moduleA', c))}
                  </div>
                  <div className="ap-picker-group">
                    <div className="ap-picker-title">Module B</div>
                    {(MODULE_B_CONTROLS[spec] || []).length === 0 && (
                      <div className="ap-picker-hint">Checklist not yet available.</div>
                    )}
                    {(MODULE_B_CONTROLS[spec] || []).map(c => renderCheckbox(spec, 'moduleB', c))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Customer sign-off</label>
            <label className="ap-check ap-check-inline">
              <input type="checkbox" checked={form.customerSignOff} onChange={e => set('customerSignOff', e.target.checked)} />
              Customer has signed off on this project
            </label>
            <input
              value={form.signOffDocument}
              onChange={e => set('signOffDocument', e.target.value)}
              placeholder="Link to sign-off document (optional)"
            />
          </div>

          <div className="form-row">
            <label>Artifacts</label>
            {form.artifacts.length > 0 && (
              <ul className="ap-artifact-edit-list">
                {form.artifacts.map((a, i) => (
                  <li key={a.id || i}>
                    <LinkIcon size={11} />
                    <span className="ap-artifact-name">{a.name || a.url}</span>
                    <button type="button" className="ap-icon-btn" onClick={() => set('artifacts', form.artifacts.filter((_, j) => j !== i))} title="Remove">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="ap-artifact-add">
              <input value={artifactName} onChange={e => setArtifactName(e.target.value)} placeholder="Name (e.g. WAR export)" />
              <input value={artifactUrl} onChange={e => setArtifactUrl(e.target.value)} placeholder="https://..." />
              <button type="button" className="btn-ghost" onClick={addArtifact} disabled={!artifactUrl.trim()}>Add</button>
            </div>
          </div>

          <div className="form-row">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Scope, outcomes, auditor talking points" />
          </div>

          {error && <div className="ap-error">{error}</div>}

          <div className="modal-footer ap-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader size={12} className="ap-spin" />}
              {initial ? 'Save changes' : 'Add project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectCard({ project, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const age        = project.goLiveDate ? monthsSince(project.goLiveDate) : null
  const specs      = project.specializations || []
  const hasModuleA = (project.controlsEvidenced || []).some(k => parseControlKey(k).moduleKey === 'moduleA')

  return (
    <div className="ap-card">
      <div className="ap-card-head">
        <div className="ap-card-title-wrap">
          <div className="ap-card-title">{project.projectName}</div>
          <div className="ap-card-meta">
            {project.customerName && <span><Building2 size={11} /> {project.customerName}</span>}
            <span><CalendarDays size={11} /> {formatDate(project.goLiveDate)}</span>
          </div>
        </div>
        <div className="ap-card-actions">
          {confirmDelete ? (
            <>
              <button className="ap-confirm-delete" onClick={onDelete}>Delete</button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="ap-icon-btn" onClick={onEdit} title="Edit project"><Pencil size={13} /></button>
              <button className="ap-icon-btn" onClick={() => setConfirmDelete(true)} title="Delete project"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </div>

      <div className="ap-badges">
        {project.customerSignOff ? (
          <span className="ap-badge ap-badge-ok">
            <CheckCircle2 size={11} /> Customer signed off
            {project.signOffDocument && (
              <a href={project.signOffDocument} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>document</a>
            )}
          </span>
        ) : (
          <span className="ap-badge ap-badge-pending"><Clock size={11} /> Sign-off pending</span>
        )}
        {age !== null && age > 24 && (
          <span className="ap-badge ap-badge-warn"><AlertTriangle size={11} /> Older than 24 months</span>
        )}
        {age !== null && age > 12 && age <= 24 && hasModuleA && (
          <span className="ap-badge ap-badge-warn"><AlertTriangle size={11} /> Outside 12-month Module A window</span>
        )}
      </div>

      {specs.length > 0 && (
        <div className="ap-spec-row">
          {specs.map(s => <span key={s} className="ap-spec">{SPEC_NAMES[s] || s}</span>)}
        </div>
      )}

      <div className="ap-section-label">Controls evidenced</div>
      {(project.controlsEvidenced || []).length === 0 ? (
        <div className="ap-muted">None linked yet</div>
      ) : (
        <div className="ap-control-row">
          {project.controlsEvidenced.map(key => {
            const c = describeControl(key)
            return (
              <span key={key} className={`ap-control ap-control-${c.module}`} title={`${SPEC_NAMES[c.spec] || c.spec} — ${c.name}`}>
                {SPEC_SHORT[c.spec] || c.spec} · {c.module} {c.number}
              </span>
            )
          })}
        </div>
      )}

      {(project.artifacts || []).length > 0 && (
        <>
          <div className="ap-section-label">Artifacts</div>
          <ul className="ap-artifact-list">
            {project.artifacts.map(a => (
              <li key={a.id}>
                <LinkIcon size={11} />
                {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.name || a.url}</a> : <span>{a.name}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {project.notes && <div className="ap-notes">{project.notes}</div>}
    </div>
  )
}

export default function AuditProjects() {
  const navigate   = useNavigate()
  const { client } = useClient()

  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState(null)   // null | 'new' | project object
  const [filter, setFilter]     = useState('all')

  async function loadProjects() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/audit/${client.id}/projects`)
      if (!res.ok) throw new Error(await apiError(res))
      setProjects(await res.json())
    } catch (err) {
      setError(`Could not load projects: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    setProjects([])
    setFilter('all')
    loadProjects()
  }, [client?.id])

  async function saveProject(form) {
    const isEdit = modal !== 'new'
    const res = await fetch(
      isEdit ? `${API}/api/audit/${client.id}/projects/${modal.id}` : `${API}/api/audit/${client.id}/projects`,
      {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isEdit ? { ...form, _etag: modal._etag } : form),
      },
    )
    if (res.status === 409) {
      await loadProjects()
      throw new Error('This project was changed elsewhere — the list has been reloaded. Close and reopen it to edit the latest version.')
    }
    if (!res.ok) throw new Error(await apiError(res))
    const saved = await res.json()
    setProjects(prev => isEdit ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev])
    setModal(null)
  }

  async function deleteProject(project) {
    setError('')
    try {
      const res = await fetch(`${API}/api/audit/${client.id}/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(await apiError(res))
      setProjects(prev => prev.filter(p => p.id !== project.id))
    } catch (err) {
      setError(`Could not delete project: ${err.message}`)
    }
  }

  if (!client) {
    return (
      <div className="audit-projects">
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

  const visible   = filter === 'all' ? projects : projects.filter(p => (p.specializations || []).includes(filter))
  const signedOff = visible.filter(p => p.customerSignOff).length
  const customers = new Set(visible.map(p => (p.customerName || '').trim().toLowerCase()).filter(Boolean)).size

  return (
    <div className="audit-projects">
      <div className="page-header">
        <div>
          <div className="page-title ap-title-row"><FolderOpen size={18} /> Audit Projects</div>
          <div className="page-sub">Customer project evidence pool for {client.name}</div>
        </div>
        <div className="header-actions">
          {loading && <span className="ap-muted ap-inline"><Loader size={12} className="ap-spin" /> Loading...</span>}
          <button className="btn-primary" onClick={() => setModal('new')}><Plus size={13} /> Add project</button>
        </div>
      </div>

      {error && <div className="ap-banner-error">{error}</div>}

      <div className="ap-toolbar">
        <div className="ap-stats">
          <div className="ap-stat"><span className="ap-stat-num">{visible.length}</span> projects</div>
          <div className="ap-stat"><span className="ap-stat-num">{customers}</span> unique customers</div>
          <div className="ap-stat"><span className="ap-stat-num">{signedOff}</span> signed off</div>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="ap-filter">
          <option value="all">All specializations</option>
          {SPECIALIZATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {!loading && visible.length === 0 ? (
        <div className="ap-empty">
          <FolderOpen size={28} />
          <div>{projects.length === 0 ? 'No customer projects yet.' : 'No projects for this specialization.'}</div>
          <p>Register delivered customer projects here and link each one to the audit controls it evidences.</p>
        </div>
      ) : (
        <div className="ap-grid">
          {visible.map(p => (
            <ProjectCard key={p.id} project={p} onEdit={() => setModal(p)} onDelete={() => deleteProject(p)} />
          ))}
        </div>
      )}

      {modal && (
        <ProjectModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={saveProject}
        />
      )}
    </div>
  )
}
