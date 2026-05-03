import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, ChevronLeft, Plus, X, Upload, RefreshCw } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from '../components/ChatVisual.jsx'
import './DataIntelligence.css'

const API = import.meta.env.VITE_API_URL || ''

const STAGES = [
  { id: 'setup',        label: 'Setup',          desc: 'Session configuration' },
  { id: 'inventory',    label: 'Data Sources',   desc: 'Map what you have' },
  { id: 'classify',     label: 'Classification', desc: 'Understand the problems' },
  { id: 'requirements', label: 'Requirements',   desc: 'Define the constraints' },
  { id: 'blueprint',    label: 'Blueprint',      desc: 'Your solution' },
]

const SOURCE_CATEGORIES = [
  'CRM', 'ERP', 'Data & Analytics', 'ITSM', 'Collaboration', 'Security',
  'HR / HCM', 'Finance', 'Supply Chain', 'On-premises DB', 'SaaS Application',
  'File-based / Legacy', 'Custom / Other',
]
const VOLUME_OPTIONS    = ['< 1 GB', '1 GB – 1 TB', '1 TB – 100 TB', '100 TB+', 'Unknown']
const FREQUENCY_OPTIONS = ['Real-time (< 1 min)', 'Near real-time (< 1 hour)', 'Daily batch', 'Weekly batch', 'Ad-hoc / manual']

const SOLUTION_PATTERNS = {
  'Data Fabric':              { icon: '🕸️', color: '#8B5CF6', desc: 'Unified semantic layer across all sources' },
  'Data Lakehouse':           { icon: '🏠', color: '#4A9FE0', desc: 'Unified analytics on structured and unstructured data' },
  'Data Mesh':                { icon: '🔗', color: '#3DBA7E', desc: 'Domain-owned data products with federated governance' },
  'Unified API Layer':        { icon: '⚡', color: '#E8A838', desc: 'Real-time API access for agents and apps' },
  'MDM':                      { icon: '🎯', color: '#EC4899', desc: 'Single source of truth for key entities' },
  'Event-Driven Integration': { icon: '📡', color: '#1A56A8', desc: 'Real-time event streaming across systems' },
  'Optimize Existing':        { icon: '🔧', color: '#3DBA7E', desc: 'Configure and adopt tools you already have' },
}

const ENTERPRISE_DOMAINS = [
  'Customer Data', 'Financial Data', 'Operational Data',
  'HR & People', 'Product & Supply', 'Infrastructure & Logs', 'Other',
]

export default function DataIntelligence() {
  const { client } = useClient()
  const navigate = useNavigate()

  // Stage
  const [stage,   setStage]   = useState(0)
  const [loading, setLoading] = useState(false)

  // Stage 0 — Setup
  const [mode,             setMode]             = useState('linked')
  const [scale,            setScale]            = useState('focused')
  const [standaloneClient, setStandaloneClient] = useState('')

  // Stage 1 — Inventory
  const [sources,              setSources]              = useState([])
  const [addingSource,         setAddingSource]         = useState(false)
  const [newSource,            setNewSource]            = useState({ name: '', category: '', owner: '', volume: '', frequency: '', hasApi: 'No', issues: '' })
  const [importedFromProfile,  setImportedFromProfile]  = useState(false)
  const [enterpriseDomain,     setEnterpriseDomain]     = useState('Customer Data')

  // Stage 2 — Classification
  const [healthProfile,      setHealthProfile]      = useState(null)
  const [findings,           setFindings]           = useState([])
  const [summary,            setSummary]            = useState('')
  const [optimizeExisting,   setOptimizeExisting]   = useState(false)
  const [dismissedFindings,  setDismissedFindings]  = useState([])

  // Stage 3 — Requirements
  const [requirements, setRequirements] = useState({
    primaryGoal:      '',
    timeline:         '',
    budget:           '',
    teamCapability:   '',
    compliance:       client?.environmentProfile?.complianceFrameworks || [],
    preserveExisting: [],
  })

  // Stage 4 — Blueprint
  const [recommendation,           setRecommendation]           = useState(null)
  const [blueprint,                setBlueprint]                = useState(null)
  const [proposedAssessmentChanges,setProposedAssessmentChanges]= useState([])
  const [saved,                    setSaved]                    = useState(false)

  // Persistence
  const [hasStoredResults, setHasStoredResults] = useState(false)
  const [storedSession,    setStoredSession]    = useState(null)
  const [sessionCount,     setSessionCount]     = useState(0)
  const [lastUpdated,      setLastUpdated]      = useState(null)
  const [startMode,        setStartMode]        = useState('checking') // 'checking' | 'results' | 'new'

  const clientName = mode === 'linked' ? (client?.name || 'Client') : (standaloneClient || 'Client')
  const vertical   = mode === 'linked' ? (client?.industry || '') : ''

  // ── Staleness helper ──────────────────────────────────────────────────────
  function isStale(dateString, thresholdDays = 90) {
    if (!dateString) return false
    return Math.floor((Date.now() - new Date(dateString)) / (1000 * 60 * 60 * 24)) > thresholdDays
  }

  // ── Load saved results on mount ───────────────────────────────────────────
  useState(() => {
    if (!client?.id || mode === 'standalone') { setStartMode('new'); return }

    fetch(`${API}/api/clients/${client.id}/data-intelligence`)
      .then(r => r.ok ? r.json() : { hasResults: false })
      .then(data => {
        if (data.hasResults && data.session) {
          setStoredSession(data.session)
          setHasStoredResults(true)
          setSessionCount(data.sessionCount || 1)
          setLastUpdated(data.lastUpdated)

          // Restore state from saved session
          if (data.session.inventory?.length)               setSources(data.session.inventory)
          if (data.session.healthProfile)                   setHealthProfile(data.session.healthProfile)
          if (data.session.findings)                        setFindings(data.session.findings)
          if (data.session.requirements)                    setRequirements(data.session.requirements)
          if (data.session.recommendation)                  setRecommendation(data.session.recommendation)
          if (data.session.optimizeExisting !== undefined)  setOptimizeExisting(data.session.optimizeExisting)
          if (data.session.summary)                         setSummary(data.session.summary)
          if (data.session.mode)                            setMode(data.session.mode)
          if (data.session.scale)                           setScale(data.session.scale)
          if (data.session.blueprint)                       setBlueprint(data.session.blueprint)
          if (data.session.recommendation?.assessmentImpacts?.length)
            setProposedAssessmentChanges(data.session.recommendation.assessmentImpacts)

          setStartMode('results')
          setStage(4)
        } else {
          setStartMode('new')
        }
      })
      .catch(() => setStartMode('new'))
  })

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateSource(id, patch) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function importFromProfile() {
    if (!client?.environmentProfile) return
    const allTools = [
      ...(client.environmentProfile.cloudTools   || []),
      ...(client.environmentProfile.onPremTools  || []),
      ...(client.environmentProfile.legacySystems || []),
    ]
    setSources(allTools.map(tool => ({
      id:          `imported-${tool}-${Date.now()}-${Math.random()}`,
      name:        tool,
      category:    '',
      owner:       '',
      volume:      'Unknown',
      frequency:   'Unknown',
      hasApi:      'Unknown',
      issues:      '',
      imported:    true,
      needsReview: true,
    })))
    setImportedFromProfile(true)
  }

  function addSource() {
    if (!newSource.name.trim()) return
    setSources(prev => [...prev, { ...newSource, id: `s-${Date.now()}`, needsReview: false }])
    setNewSource({ name: '', category: '', owner: '', volume: '', frequency: '', hasApi: 'No', issues: '' })
    setAddingSource(false)
  }

  const scoreColor = score => score <= 2 ? '#3DBA7E' : score <= 3 ? '#E8A838' : '#E05A4E'
  const scoreLabel = score => score <= 2 ? 'Healthy' : score <= 3 ? 'At risk' : 'Critical'

  // ── API calls ─────────────────────────────────────────────────────────────

  async function runAnalysis() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/data-intelligence/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inventory: sources, clientName, vertical }),
      })
      const data = await res.json()
      setHealthProfile(data.healthProfile)
      setFindings(data.findings || [])
      setSummary(data.summary || '')
      setOptimizeExisting(data.optimizeExisting || false)
      setStage(2)
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function runRecommendation() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/data-intelligence/recommend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory:     sources,
          healthProfile,
          requirements,
          findings:      findings.filter(f => !dismissedFindings.includes(f.finding)),
          clientName,
          vertical,
          existingTools: client?.environmentProfile?.cloudTools || [],
          optimizeExisting,
        }),
      })
      const rec = await res.json()
      setRecommendation(rec)
      setProposedAssessmentChanges(rec.assessmentImpacts || [])
      await generateBlueprint(rec)
    } catch (err) {
      console.error('Recommendation error:', err)
      setLoading(false)
    }
  }

  async function generateBlueprint(rec) {
    try {
      const res = await fetch(`${API}/api/data-intelligence/blueprint`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory:      sources,
          recommendation: rec,
          requirements,
          clientName,
          optimizeExisting,
        }),
      })
      const data = await res.json()
      setBlueprint(data)
      setStage(4)

      // Auto-save everything including blueprint
      if (mode === 'linked' && client?.id) {
        const session = {
          mode, scale, inventory: sources,
          healthProfile, findings, summary,
          requirements, recommendation: rec,
          blueprint: data,
          optimizeExisting,
          recommendedPattern: rec?.primaryPattern?.name,
        }
        await fetch(`${API}/api/clients/${client.id}/data-intelligence`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ session }),
        })
        setSaved(true)
        setHasStoredResults(true)
        setLastUpdated(new Date().toISOString())
        setSessionCount(c => c + 1)
      }
    } catch (err) {
      console.error('Blueprint error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Stage renderers ───────────────────────────────────────────────────────

  function renderSetup() {
    return (
      <div className="di-setup">
        <div className="di-section-title">Session setup</div>

        <div className="di-field-group">
          <label className="di-label">Engagement type</label>
          <div className="di-option-cards">
            <button className={`di-option-card ${mode === 'linked' ? 'selected' : ''}`} onClick={() => setMode('linked')}>
              <div className="doc-icon">🔗</div>
              <div className="doc-title">AI Advisory engagement</div>
              <div className="doc-desc">Links to {client?.name || 'selected client'} — results feed back into the assessment</div>
            </button>
            <button className={`di-option-card ${mode === 'standalone' ? 'selected' : ''}`} onClick={() => setMode('standalone')}>
              <div className="doc-icon">📊</div>
              <div className="doc-title">Standalone session</div>
              <div className="doc-desc">Data / reporting engagement — runs independently</div>
            </button>
          </div>
        </div>

        {mode === 'standalone' && (
          <div className="di-field-group">
            <label className="di-label">Client name</label>
            <input
              className="di-input"
              placeholder="Enter client name"
              value={standaloneClient}
              onChange={e => setStandaloneClient(e.target.value)}
            />
          </div>
        )}

        {mode === 'linked' && !client && (
          <div className="di-warning">No client selected. Go to Clients and select a client first, or switch to standalone mode.</div>
        )}

        <div className="di-field-group">
          <label className="di-label">Data environment scale</label>
          <div className="di-option-cards">
            <button className={`di-option-card ${scale === 'focused' ? 'selected' : ''}`} onClick={() => setScale('focused')}>
              <div className="doc-icon">🎯</div>
              <div className="doc-title">Focused</div>
              <div className="doc-desc">Under 15 data sources — SMB to mid-market</div>
            </button>
            <button className={`di-option-card ${scale === 'enterprise' ? 'selected' : ''}`} onClick={() => setScale('enterprise')}>
              <div className="doc-icon">🏢</div>
              <div className="doc-title">Enterprise</div>
              <div className="doc-desc">15+ data sources — large or complex environments</div>
            </button>
          </div>
        </div>

        <button
          className="di-btn-primary"
          onClick={() => setStage(1)}
          disabled={mode === 'linked' && !client}
        >
          Start data source inventory →
        </button>
      </div>
    )
  }

  function renderInventory() {
    const needsReview = sources.filter(s => s.needsReview).length
    const envToolCount = (client?.environmentProfile?.cloudTools?.length || 0) +
                         (client?.environmentProfile?.onPremTools?.length  || 0)

    const visibleSources = scale === 'focused'
      ? sources
      : sources.filter(s => s.domain === enterpriseDomain || (!s.domain && enterpriseDomain === 'Other'))

    return (
      <div className="di-inventory">
        <div className="di-section-title">Data source inventory</div>
        <div className="di-section-sub">Map every system that contains data your organisation uses to make decisions or run operations.</div>

        {mode === 'linked' && client?.environmentProfile && !importedFromProfile && (
          <div className="di-import-banner">
            <div>
              <div className="dib-title">Import from environment profile</div>
              <div className="dib-sub">{envToolCount} tools already captured for {client.name}</div>
            </div>
            <button className="di-btn-secondary" onClick={importFromProfile}>
              <Upload size={13} /> Import all
            </button>
          </div>
        )}

        {needsReview > 0 && (
          <div className="di-review-banner">
            ⚠ {needsReview} imported source{needsReview > 1 ? 's' : ''} need review — add owner, volume, and frequency details
          </div>
        )}

        {scale === 'enterprise' && (
          <div className="di-domain-tabs">
            {ENTERPRISE_DOMAINS.map(d => (
              <button
                key={d}
                className={`di-domain-tab ${enterpriseDomain === d ? 'active' : ''}`}
                onClick={() => setEnterpriseDomain(d)}
              >
                {d}
                <span className="di-domain-count">{sources.filter(s => s.domain === d || (!s.domain && d === 'Other')).length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="di-source-grid">
          {visibleSources.map(source => (
            <div key={source.id} className={`di-source-card ${source.needsReview ? 'needs-review' : ''}`}>
              <div className="dsc-header">
                <div className="dsc-name">{source.name}</div>
                <button className="dsc-remove" onClick={() => setSources(p => p.filter(s => s.id !== source.id))}>
                  <X size={12} />
                </button>
              </div>
              {source.needsReview && <div className="dsc-review-flag">Review needed</div>}
              <div className="dsc-fields">
                <select className="dsc-select" value={source.category} onChange={e => updateSource(source.id, { category: e.target.value })}>
                  <option value="">Category</option>
                  {SOURCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="dsc-input" placeholder="Data owner" value={source.owner} onChange={e => updateSource(source.id, { owner: e.target.value })} />
                <select className="dsc-select" value={source.volume} onChange={e => updateSource(source.id, { volume: e.target.value })}>
                  <option value="">Volume</option>
                  {VOLUME_OPTIONS.map(v => <option key={v}>{v}</option>)}
                </select>
                <select className="dsc-select" value={source.frequency} onChange={e => updateSource(source.id, { frequency: e.target.value })}>
                  <option value="">Update frequency</option>
                  {FREQUENCY_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
                <select className="dsc-select" value={source.hasApi} onChange={e => updateSource(source.id, { hasApi: e.target.value })}>
                  <option value="Yes">API: Yes</option>
                  <option value="No">API: No</option>
                  <option value="Partial">API: Partial</option>
                  <option value="Unknown">API: Unknown</option>
                </select>
                {scale === 'enterprise' && (
                  <select className="dsc-select" value={source.domain || ''} onChange={e => updateSource(source.id, { domain: e.target.value })}>
                    <option value="">Domain</option>
                    {ENTERPRISE_DOMAINS.map(d => <option key={d}>{d}</option>)}
                  </select>
                )}
                <input className="dsc-input" placeholder="Known issues (optional)" value={source.issues} onChange={e => updateSource(source.id, { issues: e.target.value })} />
              </div>
            </div>
          ))}

          {addingSource ? (
            <div className="di-source-card adding">
              <input
                className="dsc-input large"
                placeholder="System name (e.g. Salesforce, SQL Server)"
                value={newSource.name}
                onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))}
                autoFocus
              />
              <div className="dsc-fields">
                <select className="dsc-select" value={newSource.category} onChange={e => setNewSource(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Category</option>
                  {SOURCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="dsc-input" placeholder="Data owner (team or role)" value={newSource.owner} onChange={e => setNewSource(p => ({ ...p, owner: e.target.value }))} />
                <select className="dsc-select" value={newSource.volume} onChange={e => setNewSource(p => ({ ...p, volume: e.target.value }))}>
                  <option value="">Volume</option>
                  {VOLUME_OPTIONS.map(v => <option key={v}>{v}</option>)}
                </select>
                <select className="dsc-select" value={newSource.frequency} onChange={e => setNewSource(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="">Update frequency</option>
                  {FREQUENCY_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
                <select className="dsc-select" value={newSource.hasApi} onChange={e => setNewSource(p => ({ ...p, hasApi: e.target.value }))}>
                  <option value="No">API: No</option>
                  <option value="Yes">API: Yes</option>
                  <option value="Partial">API: Partial</option>
                </select>
                {scale === 'enterprise' && (
                  <select className="dsc-select" value={newSource.domain || ''} onChange={e => setNewSource(p => ({ ...p, domain: e.target.value }))}>
                    <option value="">Domain</option>
                    {ENTERPRISE_DOMAINS.map(d => <option key={d}>{d}</option>)}
                  </select>
                )}
                <input className="dsc-input" placeholder="Known issues" value={newSource.issues} onChange={e => setNewSource(p => ({ ...p, issues: e.target.value }))} />
              </div>
              <div className="dsc-actions">
                <button className="di-btn-primary small" onClick={addSource}>Add source</button>
                <button className="di-btn-ghost" onClick={() => setAddingSource(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="di-add-source-btn" onClick={() => setAddingSource(true)}>
              <Plus size={16} /> Add data source
            </button>
          )}
        </div>

        <div className="di-stage-footer">
          <div className="di-source-count">{sources.length} source{sources.length !== 1 ? 's' : ''} in inventory</div>
          <button
            className="di-btn-primary"
            disabled={sources.length < 2 || loading}
            onClick={runAnalysis}
          >
            {loading ? <><RefreshCw size={14} className="spin" /> Analysing…</> : 'Analyse data landscape →'}
          </button>
        </div>
      </div>
    )
  }

  function renderClassification() {
    const visibleFindings = findings.filter(f => !dismissedFindings.includes(f.finding))

    return (
      <div className="di-classification">
        <div className="di-section-title">Data health profile</div>
        {summary && <div className="di-summary-card">{summary}</div>}

        {healthProfile && (
          <div className="di-health-grid">
            {[
              { key: 'duplication',   label: 'Data Duplication',  desc: 'Same data in multiple systems' },
              { key: 'fragmentation', label: 'Fragmentation',     desc: 'Data split across systems' },
              { key: 'latency',       label: 'Data Latency',      desc: 'Freshness vs consumer needs' },
              { key: 'governance',    label: 'Governance Gaps',   desc: 'Lineage, classification, policies' },
            ].map(dim => {
              const score = healthProfile[dim.key]
              const color = scoreColor(score)
              return (
                <div key={dim.key} className="di-health-card">
                  <div className="dhc-label">{dim.label}</div>
                  <div className="dhc-score" style={{ color }}>{score}<span>/5</span></div>
                  <div className="dhc-bar">
                    <div className="dhc-fill" style={{ width: `${(score / 5) * 100}%`, background: color }} />
                  </div>
                  <div className="dhc-status" style={{ color }}>{scoreLabel(score)}</div>
                  <div className="dhc-desc">{dim.desc}</div>
                </div>
              )
            })}
          </div>
        )}

        {visibleFindings.length > 0 && (
          <div className="di-findings">
            <div className="di-findings-title">Findings ({visibleFindings.length})</div>
            {visibleFindings.map((f, i) => (
              <div key={i} className={`di-finding ${f.severity}`}>
                <div className="df-left">
                  <span className="df-severity">
                    {f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '🟡' : 'ℹ️'}
                  </span>
                  <div>
                    <div className="df-finding">{f.finding}</div>
                    <div className="df-impact">{f.impact}</div>
                    {f.systems?.length > 0 && (
                      <div className="df-systems">
                        {f.systems.map(s => <span key={s} className="df-system-tag">{s}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <button className="df-dismiss" onClick={() => setDismissedFindings(p => [...p, f.finding])}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {optimizeExisting && (
          <div className="di-optimize-note">
            ✓ You already have the right tools for this. The recommendation will focus on configuration and adoption, not net-new platform selection.
          </div>
        )}

        <div className="di-stage-footer">
          <button className="di-btn-ghost" onClick={() => setStage(1)}><ChevronLeft size={14} /> Back</button>
          <button className="di-btn-primary" onClick={() => setStage(3)}>Define requirements →</button>
        </div>
      </div>
    )
  }

  function renderRequirements() {
    const existingTools = [
      ...(client?.environmentProfile?.cloudTools  || []),
      ...(client?.environmentProfile?.onPremTools || []),
    ]

    function toggleList(field, val) {
      setRequirements(p => ({
        ...p,
        [field]: p[field]?.includes(val)
          ? p[field].filter(x => x !== val)
          : [...(p[field] || []), val],
      }))
    }

    return (
      <div className="di-requirements">
        <div className="di-section-title">Requirements</div>
        <div className="di-section-sub">These constraints determine which solution pattern fits. Be specific — the recommendation changes significantly based on your answers.</div>

        <div className="di-req-field">
          <label className="di-label">Primary goal</label>
          <div className="di-option-pills">
            {[
              'Unified reporting and analytics',
              'Real-time operational intelligence',
              'Master data management (single source of truth)',
              'Compliance and data governance',
              'Full enterprise data transformation',
            ].map(g => (
              <button key={g} className={`di-pill ${requirements.primaryGoal === g ? 'selected' : ''}`}
                onClick={() => setRequirements(p => ({ ...p, primaryGoal: g }))}>{g}</button>
            ))}
          </div>
        </div>

        <div className="di-req-field">
          <label className="di-label">Timeline</label>
          <div className="di-option-pills">
            {['Proof of concept in 30-60 days', 'Phased delivery over 6-12 months', 'Long-term transformation (12+ months)', 'Not yet defined'].map(t => (
              <button key={t} className={`di-pill ${requirements.timeline === t ? 'selected' : ''}`}
                onClick={() => setRequirements(p => ({ ...p, timeline: t }))}>{t}</button>
            ))}
          </div>
        </div>

        <div className="di-req-field">
          <label className="di-label">Budget range</label>
          <div className="di-option-pills">
            {['Under $100K', '$100K – $500K', '$500K – $2M', '$2M+', 'Not yet defined'].map(b => (
              <button key={b} className={`di-pill ${requirements.budget === b ? 'selected' : ''}`}
                onClick={() => setRequirements(p => ({ ...p, budget: b }))}>{b}</button>
            ))}
          </div>
        </div>

        <div className="di-req-field">
          <label className="di-label">Team data capability</label>
          <div className="di-option-pills">
            {['Strong data engineering team', 'Some capability — need guidance', 'Minimal capability — need managed solution'].map(t => (
              <button key={t} className={`di-pill ${requirements.teamCapability === t ? 'selected' : ''}`}
                onClick={() => setRequirements(p => ({ ...p, teamCapability: t }))}>{t}</button>
            ))}
          </div>
        </div>

        {existingTools.length > 0 && (
          <div className="di-req-field">
            <label className="di-label">Investments to preserve</label>
            <div className="di-option-pills">
              {existingTools.slice(0, 20).map(t => (
                <button key={t}
                  className={`di-pill ${requirements.preserveExisting?.includes(t) ? 'selected' : ''}`}
                  onClick={() => toggleList('preserveExisting', t)}>{t}</button>
              ))}
            </div>
          </div>
        )}

        <div className="di-req-field">
          <label className="di-label">Compliance requirements</label>
          <div className="di-option-pills">
            {['HIPAA', 'FedRAMP', 'ITAR', 'PCI-DSS', 'GDPR', 'SOC 2', 'ISO 27001', 'NIST', 'None'].map(c => (
              <button key={c}
                className={`di-pill ${requirements.compliance?.includes(c) ? 'selected' : ''}`}
                onClick={() => toggleList('compliance', c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="di-stage-footer">
          <button className="di-btn-ghost" onClick={() => setStage(2)}><ChevronLeft size={14} /> Back</button>
          <button
            className="di-btn-primary"
            disabled={!requirements.primaryGoal || !requirements.timeline || loading}
            onClick={runRecommendation}
          >
            {loading ? <><RefreshCw size={14} className="spin" /> Generating blueprint…</> : 'Generate solution blueprint →'}
          </button>
        </div>
      </div>
    )
  }

  function renderBlueprint() {
    if (!recommendation || !blueprint) {
      return (
        <div className="di-loading-state">
          <RefreshCw size={20} className="spin" /> Generating your blueprint…
        </div>
      )
    }

    const pattern     = recommendation.primaryPattern
    const patternMeta = SOLUTION_PATTERNS[pattern?.name] || SOLUTION_PATTERNS['Data Fabric']

    return (
      <div className="di-blueprint">
        <div className="di-blueprint-header">
          <div className="di-section-title">Solution blueprint</div>
          <div className="di-bp-actions">
            {saved && <span className="di-saved-badge">✓ Auto-saved</span>}
            {mode === 'linked' && (
              <button
                className="di-btn-ghost"
                onClick={() => {
                  if (window.confirm('Start a new assessment? This will clear the current results.')) {
                    setStage(0); setHasStoredResults(false); setSaved(false)
                    setSources([]); setHealthProfile(null); setFindings([])
                    setRecommendation(null); setBlueprint(null)
                    setProposedAssessmentChanges([])
                  }
                }}
              >
                ↺ New assessment
              </button>
            )}
          </div>
        </div>

        {/* Primary recommendation card */}
        <div className="di-pattern-card" style={{ borderColor: patternMeta.color }}>
          <div className="dpc-header">
            <span className="dpc-icon">{patternMeta.icon}</span>
            <div>
              <div className="dpc-name" style={{ color: patternMeta.color }}>
                {optimizeExisting ? 'Optimize Existing' : pattern?.name}
              </div>
              <div className="dpc-sub">{patternMeta.desc}</div>
            </div>
            <div className={`dpc-complexity complexity-${pattern?.complexity}`}>
              {pattern?.complexity} complexity
            </div>
          </div>
          <div className="dpc-rationale">{pattern?.rationale}</div>

          <div className="dpc-cols">
            <div>
              <div className="dpc-col-label">✓ Solves</div>
              {pattern?.solves?.map((s, i) => <div key={i} className="dpc-item solve">{s}</div>)}
            </div>
            <div>
              <div className="dpc-col-label">✗ Does not solve</div>
              {pattern?.doesNotSolve?.map((s, i) => <div key={i} className="dpc-item no-solve">{s}</div>)}
            </div>
          </div>

          {pattern?.keyProducts?.length > 0 && (
            <div className="dpc-products">
              <div className="dpc-col-label">Recommended products</div>
              <div className="dpc-product-chips">
                {pattern.keyProducts.map((p, i) => (
                  <div key={i} className={`dpc-product ${p.alreadyHave ? 'have' : 'new'}`}>
                    {p.name}
                    {p.alreadyHave && <span className="dpc-have-badge">already have</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optimize existing quick wins */}
        {optimizeExisting && recommendation.optimizeExistingPath && (
          <div className="di-optimize-path">
            <div className="di-findings-title">Quick wins — configuration changes</div>
            {recommendation.optimizeExistingPath.quickWins?.map((w, i) => (
              <div key={i} className="di-finding info">
                <span>⚡</span>
                <div className="df-finding">{w}</div>
              </div>
            ))}
          </div>
        )}

        {/* Blueprint visuals */}
        {blueprint.visuals?.map((visual, i) => (
          <div key={i} className="di-visual-section">
            {visual.narrative && (
              <div className="visual-narrative">
                {visual.narrative.headline && <div className="vn-headline">{visual.narrative.headline}</div>}
                {visual.narrative.context  && <p className="vn-context">{visual.narrative.context}</p>}
                {visual.narrative.actions?.length > 0 && (
                  <div className="vn-actions">
                    <div className="vn-actions-label">KEY ACTIONS</div>
                    {visual.narrative.actions.map((a, j) => (
                      <div key={j} className="vn-action-item"><span className="vn-action-arrow">→</span>{a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="chat-visual-wrapper">
              <ChatVisual visual={visual} />
            </div>
          </div>
        ))}

        {/* Assessment feedback loop */}
        {mode === 'linked' && proposedAssessmentChanges?.length > 0 && (
          <div className="di-assessment-feedback">
            <div className="di-findings-title">Proposed assessment updates</div>
            <div className="di-section-sub">Based on these findings, the following assessment answers should be reviewed:</div>
            {proposedAssessmentChanges.map((change, i) => (
              <div key={i} className="di-proposed-change">
                <div className="dpc-pill" style={{ background: 'var(--z-blue-glow)', color: 'var(--z-blue-bright)' }}>
                  {change.pillar}
                </div>
                <div className="dpc-change-content">
                  <div className="dpc-change-hint">{change.questionHint}</div>
                  <div className="dpc-change-answer">Proposed: <strong>{change.proposedAnswer}</strong></div>
                  <div className="dpc-change-reason">{change.reason}</div>
                </div>
              </div>
            ))}
            <button className="di-btn-secondary" onClick={() => navigate('/assessment')}>
              Review assessment answers →
            </button>
          </div>
        )}

        {/* Zones engagement model */}
        {recommendation.zonesEngagement && (
          <div className="di-engagement-card">
            <div className="di-findings-title">Zones engagement model</div>
            <div className="dec-type">{recommendation.zonesEngagement.type}</div>
            {recommendation.zonesEngagement.phases?.map((p, i) => (
              <div key={i} className="dec-phase">
                <div className="dec-phase-name">{p.name}</div>
                <div className="dec-phase-dur">{p.duration}</div>
                <div className="dec-phase-del">{p.deliverable}</div>
              </div>
            ))}
            <div className="dec-investment">
              Estimated investment: <strong>{recommendation.zonesEngagement.investmentRange}</strong>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  const pageHeader = (
    <div className="di-page-header">
      <div className="di-brand">
        <Database size={18} color="#4A9FE0" />
        <div>
          <div className="di-brand-name">Zones Compass</div>
          <div className="di-brand-module">Data Intelligence</div>
        </div>
      </div>
      {client && mode === 'linked' && (
        <div className="di-client-badge">{client.name}</div>
      )}
    </div>
  )

  // Loading state while checking for saved results
  if (startMode === 'checking' && client?.id && mode === 'linked') {
    return (
      <div className="di-page">
        {pageHeader}
        <div className="di-loading-state">Loading data intelligence results…</div>
      </div>
    )
  }

  return (
    <div className="di-page">
      {pageHeader}

      {/* Results banner — shown when saved results are loaded */}
      {hasStoredResults && stage === 4 && (
        <div className="di-results-banner">
          <div className="di-rb-left">
            <span className="di-rb-icon">✓</span>
            <div>
              <div className="di-rb-title">
                Data Intelligence assessment complete
                {sessionCount > 1 && <span className="di-rb-count">{sessionCount} sessions</span>}
              </div>
              <div className="di-rb-sub">
                Last assessed {lastUpdated
                  ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : 'recently'}
                {storedSession?.recommendation?.primaryPattern?.name && ` · ${storedSession.recommendation.primaryPattern.name} recommended`}
              </div>
            </div>
          </div>
          <div className="di-rb-actions">
            {isStale(lastUpdated) && (
              <span className="di-stale-label">⏱ {Math.floor((Date.now() - new Date(lastUpdated)) / (1000*60*60*24))} days old</span>
            )}
            <button
              className="di-btn-ghost"
              onClick={() => {
                setStage(0); setHasStoredResults(false); setSaved(false)
                setSources([]); setHealthProfile(null); setFindings([])
                setRecommendation(null); setBlueprint(null); setProposedAssessmentChanges([])
              }}
            >
              Start new assessment
            </button>
            <button className="di-btn-secondary" onClick={() => setStage(1)}>
              Edit inventory & re-run
            </button>
          </div>
        </div>
      )}

      {/* Stage progress */}
      <div className="di-progress">
        <div className="di-progress-track">
          <div className="di-progress-fill" style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }} />
        </div>
        {STAGES.map((s, i) => (
          <div
            key={s.id}
            className={`di-stage-step ${i === stage ? 'active' : ''} ${i < stage ? 'done' : ''}`}
            onClick={() => i < stage && setStage(i)}
          >
            <div className="di-step-dot">{i < stage ? '✓' : i + 1}</div>
            <div className="di-step-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="di-content">
        {stage === 0 && renderSetup()}
        {stage === 1 && renderInventory()}
        {stage === 2 && renderClassification()}
        {stage === 3 && renderRequirements()}
        {stage === 4 && renderBlueprint()}
      </div>
    </div>
  )
}
