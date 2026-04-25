import { useState, useEffect } from 'react'
import { Edit2, X, Loader } from 'lucide-react'
import './Clients.css'

const API = import.meta.env.VITE_API_URL || ''

const STATUS_COLORS = {
  'In Progress': '#4A9FE0',
  'Completed':   '#3DBA7E',
  'Kickoff':     '#8B5CF6',
  'Assessment':  '#E8A838',
}
const STATUS_OPTIONS = ['Kickoff', 'Assessment', 'In Progress', 'Completed']

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const EMPTY_FORM = { name: '', industry: '', advisor: '', size: '', status: 'Kickoff', currentSession: 1 }

function ClientModal({ client, onClose, onSave }) {
  const isEdit = !!client
  const [form, setForm] = useState(
    isEdit
      ? { name: client.name, industry: client.industry || '', advisor: client.advisor || '', size: client.size || '', status: client.status, currentSession: client.currentSession }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await fetch(`${API}/api/clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch(`${API}/api/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Client' : 'New Client'}</div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-row">
            <label>Client Name *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="form-row-2">
            <div className="form-row">
              <label>Industry</label>
              <input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Financial Services" />
            </div>
            <div className="form-row">
              <label>Company Size</label>
              <input value={form.size} onChange={e => set('size', e.target.value)} placeholder="500–2,000 employees" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-row">
              <label>Advisor</label>
              <input value={form.advisor} onChange={e => set('advisor', e.target.value)} placeholder="Sarah Mitchell" />
            </div>
            {isEdit && (
              <div className="form-row">
                <label>Session #</label>
                <input type="number" min={1} max={12} value={form.currentSession} onChange={e => set('currentSession', +e.target.value)} />
              </div>
            )}
          </div>
          {isEdit && (
            <div className="form-row">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? <><Loader size={13} className="spin" /> Saving…</>
                : isEdit ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | client object

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/clients`)
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      setClients(await res.json())
    } catch (err) {
      console.error('Failed to load clients:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="clients">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">
            {loading ? '…' : `${clients.length} active engagement${clients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>+ New Client</button>
      </div>

      <div className="clients-table">
        <div className="table-header">
          <div>Client</div>
          <div>Advisor</div>
          <div>Session</div>
          <div>Status</div>
          <div>Maturity Score</div>
          <div />
        </div>

        {loading ? (
          <div className="table-empty"><Loader size={15} className="spin" /> Loading clients…</div>
        ) : error ? (
          <div className="table-empty table-error">
            API error: {error} — check the backend is running and Cosmos DB is reachable.
          </div>
        ) : clients.length === 0 ? (
          <div className="table-empty">No clients yet. Create one to get started.</div>
        ) : (
          clients.map(c => (
            <div key={c.id} className="table-row">
              <div className="client-cell">
                <div className="client-avatar-sm">{initials(c.name)}</div>
                <span>{c.name}</span>
              </div>
              <div className="cell-muted">{c.advisor || '—'}</div>
              <div className="cell-muted">Session {c.currentSession}</div>
              <div>
                <span
                  className="status-badge"
                  style={{
                    background: (STATUS_COLORS[c.status] || '#888') + '22',
                    color: STATUS_COLORS[c.status] || '#888',
                  }}
                >
                  {c.status}
                </span>
              </div>
              <div>
                {c.overallScore != null
                  ? (
                    <div className="score-display">
                      <div className="score-bar-sm">
                        <div className="score-fill-sm" style={{ width: `${(c.overallScore / 5) * 100}%` }} />
                      </div>
                      <span>{c.overallScore}/5</span>
                    </div>
                  )
                  : <span className="cell-muted">—</span>
                }
              </div>
              <div className="edit-cell">
                <button className="btn-icon" onClick={() => setModal(c)} title="Edit client">
                  <Edit2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <ClientModal
          client={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
