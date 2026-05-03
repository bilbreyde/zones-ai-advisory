import { useState, useEffect, useRef } from 'react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from '../components/ChatVisual.jsx'
import { Cloud, Upload, Calculator, ClipboardList, Map, CheckCircle, Loader, AlertCircle, ArrowRight, Plus, Trash2, FileText } from 'lucide-react'
import './CloudModernization.css'

const API = import.meta.env.VITE_API_URL || ''

const STAGES = [
  { id: 'setup',        label: 'Setup',         icon: Cloud },
  { id: 'inventory',    label: 'Inventory',      icon: ClipboardList },
  { id: 'vmware',       label: 'VMware',         icon: Calculator },
  { id: 'requirements', label: 'Requirements',   icon: FileText },
  { id: 'scoring',      label: '6R Scoring',     icon: Map },
  { id: 'blueprint',    label: 'Blueprint',      icon: CheckCircle },
]

const SIX_R_COLORS = {
  Rehost:     '#4A9FE0',
  Replatform: '#8B5CF6',
  Refactor:   '#3DBA7E',
  Repurchase: '#E8A838',
  Retire:     '#E05A4E',
  Retain:     '#6B7280',
}

const WORKLOAD_TYPES = ['Web Application', 'Database', 'File Server', 'Custom App', 'ERP/CRM', 'Analytics', 'Dev/Test', 'Other']
const PLATFORMS      = ['VMware vSphere', 'Hyper-V', 'Physical/Bare Metal', 'AWS', 'Azure', 'GCP', 'Other On-Prem']
const CRITICALITY    = ['Critical', 'High', 'Medium', 'Low']
const CHANGE_SENSITIVITY = ['Low', 'Medium', 'High', 'Very High']
const DATA_RESIDENCY     = ['US Only', 'EU Only', 'Global OK', 'Sovereign Required']

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)    return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function emptyWorkload() {
  return {
    id: Date.now() + Math.random(),
    name: '',
    type: WORKLOAD_TYPES[0],
    platform: PLATFORMS[0],
    vcpu: '',
    ramGb: '',
    storageTb: '',
    criticality: 'Medium',
    changeSensitivity: 'Medium',
    dataResidency: 'US Only',
    notes: '',
  }
}

export default function CloudModernization() {
  const { client } = useClient()
  const fileRef = useRef(null)

  const [stage,        setStage]        = useState(0)
  const [hasResults,   setHasResults]   = useState(false)

  // Stage 0 — Setup
  const [targetCloud,   setTargetCloud]   = useState('Azure')
  const [timeline,      setTimeline]      = useState('12 months')
  const [budgetRange,   setBudgetRange]   = useState('')
  const [constraints,   setConstraints]   = useState('')

  // Stage 1 — Inventory
  const [workloads,    setWorkloads]    = useState([emptyWorkload()])
  const [csvParsing,   setCsvParsing]   = useState(false)
  const [csvPreview,   setCsvPreview]   = useState(null)
  const [csvError,     setCsvError]     = useState('')

  // Stage 2 — VMware
  const [vmwareCount,      setVmwareCount]      = useState(0)
  const [vmwareVcpu,       setVmwareVcpu]       = useState('')
  const [vmwareRamGb,      setVmwareRamGb]      = useState('')
  const [vmwareStorageTb,  setVmwareStorageTb]  = useState('')
  const [vmwareCostMonth,  setVmwareCostMonth]  = useState('')
  const [calcLoading,      setCalcLoading]      = useState(false)
  const [calcResult,       setCalcResult]       = useState(null)
  const [calcError,        setCalcError]        = useState('')

  // Stage 3 — Requirements
  const [complianceReqs,   setComplianceReqs]   = useState([])
  const [networkArch,      setNetworkArch]      = useState('Hub-Spoke')
  const [haRequirement,    setHaRequirement]    = useState(false)
  const [drRequirement,    setDrRequirement]    = useState(false)
  const [managedServices,  setManagedServices]  = useState(true)
  const [additionalReqs,   setAdditionalReqs]   = useState('')

  // Stage 4 — 6R Scoring
  const [scoringLoading, setScoringLoading] = useState(false)
  const [scoringResult,  setScoringResult]  = useState(null)
  const [scoringError,   setScoringError]   = useState('')

  // Stage 5 — Blueprint
  const [bpLoading,  setBpLoading]  = useState(false)
  const [blueprint,  setBlueprint]  = useState(null)
  const [bpError,    setBpError]    = useState('')

  // ── On-mount: restore stored results ────────────────────────────────────────
  useEffect(() => {
    if (!client) return
    fetch(`${API}/api/cloud-modernization/clients/${client.id}/cloud-modernization`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        // Restore workloads from most recent session
        if (data.workloads?.length) setWorkloads(data.workloads)
        if (data.targetCloud)      setTargetCloud(data.targetCloud)
        if (data.timeline)         setTimeline(data.timeline)
        if (data.budgetRange)      setBudgetRange(data.budgetRange)
        if (data.constraints)      setConstraints(data.constraints)
        if (data.calcResult)       setCalcResult(data.calcResult)
        if (data.scoringResult)    setScoringResult(data.scoringResult)
        if (data.blueprint)        setBlueprint(data.blueprint)
        if (data.blueprint) {
          setHasResults(true)
          setStage(5)
        } else if (data.scoringResult) {
          setHasResults(true)
          setStage(4)
        }
      })
      .catch(() => {})
  }, [client?.id])

  // ── Auto-sync VMware count from workloads ────────────────────────────────────
  useEffect(() => {
    const vmWks = workloads.filter(w =>
      w.platform?.toLowerCase().includes('vmware') ||
      w.platform?.toLowerCase().includes('vsphere')
    )
    if (vmWks.length > 0) {
      setVmwareCount(vmWks.length)
      const totalVcpu    = vmWks.reduce((s, w) => s + (parseFloat(w.vcpu)       || 0), 0)
      const totalRam     = vmWks.reduce((s, w) => s + (parseFloat(w.ramGb)      || 0), 0)
      const totalStorage = vmWks.reduce((s, w) => s + (parseFloat(w.storageTb)  || 0), 0)
      if (totalVcpu    > 0) setVmwareVcpu(String(totalVcpu))
      if (totalRam     > 0) setVmwareRamGb(String(totalRam))
      if (totalStorage > 0) setVmwareStorageTb(String(totalStorage))
    }
  }, [workloads])

  // ── CSV parsing ──────────────────────────────────────────────────────────────
  async function parseCsv(file) {
    setCsvError('')
    setCsvParsing(true)
    setCsvPreview(null)
    try {
      const text = await file.text()
      const res  = await fetch(`${API}/api/cloud-modernization/parse-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      if (!res.ok) throw new Error('CSV parse failed')
      const data = await res.json()
      setCsvPreview(data.workloads || [])
    } catch (e) {
      setCsvError(e.message)
    } finally {
      setCsvParsing(false)
    }
  }

  function acceptCsvImport() {
    if (!csvPreview) return
    setWorkloads(prev => [
      ...prev.filter(w => w.name),
      ...csvPreview.map(w => ({ ...emptyWorkload(), ...w, id: Date.now() + Math.random() })),
    ])
    setCsvPreview(null)
  }

  // ── Workload CRUD ────────────────────────────────────────────────────────────
  function addWorkload() {
    setWorkloads(prev => [...prev, emptyWorkload()])
  }

  function updateWorkload(id, field, value) {
    setWorkloads(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w))
  }

  function removeWorkload(id) {
    setWorkloads(prev => prev.filter(w => w.id !== id))
  }

  // ── VMware calculator ────────────────────────────────────────────────────────
  async function runCalculator() {
    setCalcError('')
    setCalcLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/vmware-calculator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vmCount:      parseInt(vmwareCount) || 0,
          vcpu:         parseFloat(vmwareVcpu) || 0,
          ramGb:        parseFloat(vmwareRamGb) || 0,
          storageTb:    parseFloat(vmwareStorageTb) || 0,
          currentCost:  parseFloat(vmwareCostMonth) || 0,
        }),
      })
      if (!res.ok) throw new Error('Calculator failed')
      const data = await res.json()
      setCalcResult(data)
    } catch (e) {
      setCalcError(e.message)
    } finally {
      setCalcLoading(false)
    }
  }

  // ── 6R Scoring ───────────────────────────────────────────────────────────────
  async function runScoring() {
    if (!client) return
    setScoringError('')
    setScoringLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/score-workloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:   client.id,
          workloads,
          targetCloud,
          constraints,
          complianceReqs,
          haRequirement,
          drRequirement,
        }),
      })
      if (!res.ok) throw new Error('Scoring failed')
      const data = await res.json()
      setScoringResult(data)
      setHasResults(true)
    } catch (e) {
      setScoringError(e.message)
    } finally {
      setScoringLoading(false)
    }
  }

  // ── Blueprint generation ─────────────────────────────────────────────────────
  async function generateBlueprint() {
    if (!client) return
    setBpError('')
    setBpLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:     client.id,
          workloads,
          scoringResult,
          calcResult,
          targetCloud,
          timeline,
          budgetRange,
          constraints,
          complianceReqs,
          haRequirement,
          drRequirement,
          managedServices,
          networkArch,
          additionalReqs,
        }),
      })
      if (!res.ok) throw new Error('Blueprint generation failed')
      const data = await res.json()
      setBlueprint(data)
    } catch (e) {
      setBpError(e.message)
    } finally {
      setBpLoading(false)
    }
  }

  // ── Stage renderers ──────────────────────────────────────────────────────────
  function renderSetup() {
    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">Migration Setup</h3>
        <p className="cm-stage-desc">Define the target cloud environment and project constraints before building your workload inventory.</p>

        <div className="cm-form-grid">
          <div className="cm-field">
            <label>Target Cloud Platform</label>
            <select value={targetCloud} onChange={e => setTargetCloud(e.target.value)}>
              <option>Azure</option>
              <option>AWS</option>
              <option>Google Cloud</option>
              <option>Multi-Cloud</option>
            </select>
          </div>
          <div className="cm-field">
            <label>Migration Timeline</label>
            <select value={timeline} onChange={e => setTimeline(e.target.value)}>
              <option>6 months</option>
              <option>12 months</option>
              <option>18 months</option>
              <option>24 months</option>
              <option>36+ months</option>
            </select>
          </div>
          <div className="cm-field">
            <label>Budget Range (optional)</label>
            <input
              type="text"
              placeholder="e.g. $500K – $2M"
              value={budgetRange}
              onChange={e => setBudgetRange(e.target.value)}
            />
          </div>
          <div className="cm-field cm-field-full">
            <label>Key Constraints</label>
            <textarea
              rows={3}
              placeholder="Compliance requirements, network restrictions, legacy dependencies, vendor contracts…"
              value={constraints}
              onChange={e => setConstraints(e.target.value)}
            />
          </div>
        </div>

        <div className="cm-nav-row">
          <button className="cm-btn-primary" onClick={() => setStage(1)}>
            Next: Workload Inventory <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderInventory() {
    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">Workload Inventory</h3>
        <p className="cm-stage-desc">Add workloads manually or import from a CSV. Each workload will receive a 6R migration recommendation.</p>

        <div className="cm-csv-row">
          <button className="cm-btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => e.target.files[0] && parseCsv(e.target.files[0])}
          />
          {csvParsing && <span className="cm-csv-status"><span className="cm-spin" /> Parsing…</span>}
          {csvError   && <span className="cm-csv-error"><AlertCircle size={13} /> {csvError}</span>}
        </div>

        {csvPreview && (
          <div className="cm-csv-preview">
            <div className="cm-csv-preview-header">
              <strong>{csvPreview.length} workloads found in CSV</strong>
              <div className="cm-csv-preview-actions">
                <button className="cm-btn-primary" onClick={acceptCsvImport}>Accept Import</button>
                <button className="cm-btn-ghost" onClick={() => setCsvPreview(null)}>Cancel</button>
              </div>
            </div>
            <div className="cm-csv-preview-list">
              {csvPreview.slice(0, 5).map((w, i) => (
                <div key={i} className="cm-csv-preview-row">
                  <strong>{w.name || `Workload ${i + 1}`}</strong>
                  <span>{w.type}</span>
                  <span>{w.platform}</span>
                  <span>{w.vcpu} vCPU · {w.ramGb} GB RAM</span>
                </div>
              ))}
              {csvPreview.length > 5 && <div className="cm-csv-more">…and {csvPreview.length - 5} more</div>}
            </div>
          </div>
        )}

        <div className="cm-workloads">
          {workloads.map((wl, idx) => (
            <div key={wl.id} className="cm-workload-card">
              <div className="cm-wl-header">
                <span className="cm-wl-num">#{idx + 1}</span>
                <button className="cm-wl-remove" onClick={() => removeWorkload(wl.id)}><Trash2 size={13} /></button>
              </div>
              <div className="cm-wl-grid">
                <div className="cm-field">
                  <label>Name</label>
                  <input type="text" placeholder="e.g. CRM Database" value={wl.name} onChange={e => updateWorkload(wl.id, 'name', e.target.value)} />
                </div>
                <div className="cm-field">
                  <label>Type</label>
                  <select value={wl.type} onChange={e => updateWorkload(wl.id, 'type', e.target.value)}>
                    {WORKLOAD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="cm-field">
                  <label>Current Platform</label>
                  <select value={wl.platform} onChange={e => updateWorkload(wl.id, 'platform', e.target.value)}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="cm-field">
                  <label>vCPU</label>
                  <input type="number" placeholder="4" value={wl.vcpu} onChange={e => updateWorkload(wl.id, 'vcpu', e.target.value)} />
                </div>
                <div className="cm-field">
                  <label>RAM (GB)</label>
                  <input type="number" placeholder="16" value={wl.ramGb} onChange={e => updateWorkload(wl.id, 'ramGb', e.target.value)} />
                </div>
                <div className="cm-field">
                  <label>Storage (TB)</label>
                  <input type="number" placeholder="1" step="0.1" value={wl.storageTb} onChange={e => updateWorkload(wl.id, 'storageTb', e.target.value)} />
                </div>
                <div className="cm-field">
                  <label>Criticality</label>
                  <select value={wl.criticality} onChange={e => updateWorkload(wl.id, 'criticality', e.target.value)}>
                    {CRITICALITY.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cm-field">
                  <label>Change Sensitivity</label>
                  <select value={wl.changeSensitivity} onChange={e => updateWorkload(wl.id, 'changeSensitivity', e.target.value)}>
                    {CHANGE_SENSITIVITY.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="cm-field">
                  <label>Data Residency</label>
                  <select value={wl.dataResidency} onChange={e => updateWorkload(wl.id, 'dataResidency', e.target.value)}>
                    {DATA_RESIDENCY.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="cm-field cm-field-full">
                  <label>Notes</label>
                  <input type="text" placeholder="Dependencies, special requirements…" value={wl.notes} onChange={e => updateWorkload(wl.id, 'notes', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="cm-btn-add" onClick={addWorkload}><Plus size={14} /> Add Workload</button>

        <div className="cm-nav-row">
          <button className="cm-btn-ghost" onClick={() => setStage(0)}>← Back</button>
          <button
            className="cm-btn-primary"
            onClick={() => setStage(2)}
            disabled={workloads.filter(w => w.name).length === 0}
          >
            Next: VMware Assessment <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderVmware() {
    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">VMware Cost Comparison</h3>
        <p className="cm-stage-desc">Compare your current VMware environment against Azure VMware Solution (AVS) and native Azure IaaS. Auto-populated from VMware workloads in your inventory.</p>

        <div className="cm-form-grid">
          <div className="cm-field">
            <label>VM Count</label>
            <input type="number" value={vmwareCount} onChange={e => setVmwareCount(e.target.value)} placeholder="0" />
          </div>
          <div className="cm-field">
            <label>Total vCPU</label>
            <input type="number" value={vmwareVcpu} onChange={e => setVmwareVcpu(e.target.value)} placeholder="0" />
          </div>
          <div className="cm-field">
            <label>Total RAM (GB)</label>
            <input type="number" value={vmwareRamGb} onChange={e => setVmwareRamGb(e.target.value)} placeholder="0" />
          </div>
          <div className="cm-field">
            <label>Total Storage (TB)</label>
            <input type="number" step="0.1" value={vmwareStorageTb} onChange={e => setVmwareStorageTb(e.target.value)} placeholder="0" />
          </div>
          <div className="cm-field">
            <label>Current Monthly Cost ($)</label>
            <input type="number" value={vmwareCostMonth} onChange={e => setVmwareCostMonth(e.target.value)} placeholder="0" />
          </div>
        </div>

        <button className="cm-btn-primary" onClick={runCalculator} disabled={calcLoading}>
          {calcLoading ? <><span className="cm-spin" /> Calculating…</> : <><Calculator size={14} /> Run Comparison</>}
        </button>

        {calcError && <div className="cm-error"><AlertCircle size={14} /> {calcError}</div>}

        {calcResult && (
          <div className="cm-calc-results">
            <h4>Cost Comparison (Monthly)</h4>
            <div className="cm-compare-grid">
              {[
                { label: 'Current VMware',    value: calcResult.currentMonthly,  key: 'current' },
                { label: 'Azure VMware (AVS)', value: calcResult.avsMonthly,    key: 'avs' },
                { label: 'Azure IaaS',         value: calcResult.iaasMonthly,   key: 'iaas' },
                { label: 'Nutanix',            value: calcResult.nutanixMonthly, key: 'nutanix' },
              ].map(item => {
                const saving   = (calcResult.currentMonthly || 0) - item.value
                const positive = saving > 0
                return (
                  <div key={item.key} className={`ccc-card ${item.key === 'iaas' ? 'ccc-recommended' : ''}`}>
                    <div className="ccc-label">{item.label}</div>
                    <div className="ccc-value">{formatCurrency(item.value)}<span>/mo</span></div>
                    {item.key !== 'current' && saving !== 0 && (
                      <div className={`ccc-saving ${positive ? 'positive' : 'negative'}`}>
                        {positive ? '↓' : '↑'} {formatCurrency(Math.abs(saving))}/mo vs current
                      </div>
                    )}
                    {item.key === 'avs' && calcResult.avsNodes && (
                      <div className="ccc-detail">{calcResult.avsNodes} AV36P nodes</div>
                    )}
                  </div>
                )
              })}
            </div>
            {calcResult.recommendation && (
              <div className="cm-recommendation">
                <strong>Recommendation:</strong> {calcResult.recommendation}
              </div>
            )}
          </div>
        )}

        <div className="cm-nav-row">
          <button className="cm-btn-ghost" onClick={() => setStage(1)}>← Back</button>
          <button className="cm-btn-primary" onClick={() => setStage(3)}>
            Next: Requirements <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderRequirements() {
    const COMPLIANCE_OPTIONS = ['PCI-DSS', 'HIPAA', 'SOC 2', 'ISO 27001', 'FedRAMP', 'GDPR', 'CCPA', 'ITAR']
    const toggleCompliance = opt => setComplianceReqs(prev =>
      prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
    )

    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">Migration Requirements</h3>
        <p className="cm-stage-desc">Define compliance, availability, and architecture requirements that will shape 6R scoring and the migration blueprint.</p>

        <div className="cm-section-label">Compliance Frameworks</div>
        <div className="cm-chip-grid">
          {COMPLIANCE_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`cm-chip ${complianceReqs.includes(opt) ? 'cm-chip-active' : ''}`}
              onClick={() => toggleCompliance(opt)}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="cm-form-grid" style={{ marginTop: 20 }}>
          <div className="cm-field">
            <label>Network Architecture</label>
            <select value={networkArch} onChange={e => setNetworkArch(e.target.value)}>
              <option>Hub-Spoke</option>
              <option>Flat/Peered</option>
              <option>Zero Trust</option>
              <option>SD-WAN</option>
            </select>
          </div>
        </div>

        <div className="cm-toggle-row">
          <label className="cm-toggle">
            <input type="checkbox" checked={haRequirement} onChange={e => setHaRequirement(e.target.checked)} />
            <span className="cm-toggle-label">High Availability Required</span>
          </label>
          <label className="cm-toggle">
            <input type="checkbox" checked={drRequirement} onChange={e => setDrRequirement(e.target.checked)} />
            <span className="cm-toggle-label">Disaster Recovery Required</span>
          </label>
          <label className="cm-toggle">
            <input type="checkbox" checked={managedServices} onChange={e => setManagedServices(e.target.checked)} />
            <span className="cm-toggle-label">Prefer Managed Services (PaaS)</span>
          </label>
        </div>

        <div className="cm-field cm-field-full" style={{ marginTop: 16 }}>
          <label>Additional Requirements</label>
          <textarea
            rows={3}
            placeholder="Latency requirements, vendor preferences, integration constraints…"
            value={additionalReqs}
            onChange={e => setAdditionalReqs(e.target.value)}
          />
        </div>

        <div className="cm-nav-row">
          <button className="cm-btn-ghost" onClick={() => setStage(2)}>← Back</button>
          <button className="cm-btn-primary" onClick={() => { setStage(4); runScoring() }}>
            Run 6R Analysis <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderScoring() {
    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">6R Migration Scoring</h3>
        <p className="cm-stage-desc">AI-powered 6R classification for each workload: Rehost, Replatform, Refactor, Repurchase, Retire, or Retain.</p>

        {scoringLoading && (
          <div className="cm-loading-state">
            <Loader size={24} className="cm-spin-icon" />
            <p>Analyzing {workloads.length} workloads against 6R framework…</p>
          </div>
        )}

        {scoringError && <div className="cm-error"><AlertCircle size={14} /> {scoringError}</div>}

        {scoringResult && (
          <>
            <div className="cm-6r-summary">
              {Object.entries(
                scoringResult.workloads?.reduce((acc, w) => {
                  acc[w.recommendation] = (acc[w.recommendation] || 0) + 1
                  return acc
                }, {}) || {}
              ).map(([r, count]) => (
                <div key={r} className="cm-6r-pill" style={{ background: SIX_R_COLORS[r] + '22', color: SIX_R_COLORS[r], borderColor: SIX_R_COLORS[r] + '55' }}>
                  <strong>{count}</strong> {r}
                </div>
              ))}
            </div>

            <div className="cm-scoring-list">
              {scoringResult.workloads?.map((w, i) => (
                <div key={i} className="cm-scoring-row">
                  <div className="cm-sr-name">{w.name}</div>
                  <div
                    className="cm-sr-badge"
                    style={{ background: SIX_R_COLORS[w.recommendation] + '22', color: SIX_R_COLORS[w.recommendation] }}
                  >
                    {w.recommendation}
                  </div>
                  <div className="cm-sr-rationale">{w.rationale}</div>
                  <div className="cm-sr-effort">
                    Effort: <strong>{w.effort}</strong> · Risk: <strong>{w.risk}</strong>
                  </div>
                </div>
              ))}
            </div>

            {scoringResult.summary && (
              <div className="cm-scoring-summary">
                <strong>Summary:</strong> {scoringResult.summary}
              </div>
            )}
          </>
        )}

        <div className="cm-nav-row">
          <button className="cm-btn-ghost" onClick={() => setStage(3)}>← Back</button>
          <button
            className="cm-btn-primary"
            onClick={() => { setStage(5); generateBlueprint() }}
            disabled={!scoringResult || bpLoading}
          >
            Generate Blueprint <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderBlueprint() {
    return (
      <div className="cm-stage-content">
        <h3 className="cm-stage-title">Migration Blueprint</h3>
        <p className="cm-stage-desc">A strategic migration plan with phased roadmap, architecture recommendations, and risk mitigation guidance.</p>

        {bpLoading && (
          <div className="cm-loading-state">
            <Loader size={24} className="cm-spin-icon" />
            <p>Generating migration blueprint for {workloads.filter(w => w.name).length} workloads…</p>
          </div>
        )}

        {bpError && <div className="cm-error"><AlertCircle size={14} /> {bpError}</div>}

        {blueprint && (
          <div className="cm-blueprint">
            {blueprint.summary && (
              <div className="cm-bp-section">
                <h4>Executive Summary</h4>
                <p>{blueprint.summary}</p>
              </div>
            )}

            {blueprint.phases?.length > 0 && (
              <div className="cm-bp-section">
                <h4>Migration Phases</h4>
                {blueprint.phases.map((phase, i) => (
                  <div key={i} className="cm-bp-phase">
                    <div className="cm-bp-phase-header">
                      <span className="cm-bp-phase-num">Phase {i + 1}</span>
                      <span className="cm-bp-phase-name">{phase.name}</span>
                      <span className="cm-bp-phase-timeline">{phase.timeline}</span>
                    </div>
                    {phase.workloads?.length > 0 && (
                      <div className="cm-bp-phase-workloads">
                        {phase.workloads.map((w, j) => (
                          <span key={j} className="cm-bp-wl-tag">{w}</span>
                        ))}
                      </div>
                    )}
                    {phase.actions?.length > 0 && (
                      <ul className="cm-bp-actions">
                        {phase.actions.map((a, j) => <li key={j}>{a}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {blueprint.risks?.length > 0 && (
              <div className="cm-bp-section">
                <h4>Risk Mitigation</h4>
                <ul className="cm-bp-risks">
                  {blueprint.risks.map((r, i) => (
                    <li key={i}><strong>{r.risk}:</strong> {r.mitigation}</li>
                  ))}
                </ul>
              </div>
            )}

            {blueprint.architectureNotes && (
              <div className="cm-bp-section">
                <h4>Architecture Notes</h4>
                <p>{blueprint.architectureNotes}</p>
              </div>
            )}

            {blueprint.estimatedCost && (
              <div className="cm-bp-section">
                <h4>Cost Estimate</h4>
                <p>{blueprint.estimatedCost}</p>
              </div>
            )}

            {blueprint.visuals?.length > 0 && (
              <div className="cm-bp-section">
                <h4>Architecture Diagram</h4>
                {blueprint.visuals.map((v, i) => (
                  <ChatVisual key={i} visual={v} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="cm-nav-row">
          <button className="cm-btn-ghost" onClick={() => setStage(4)}>← Back to Scoring</button>
          {!bpLoading && !blueprint && (
            <button className="cm-btn-primary" onClick={generateBlueprint}>
              Retry Blueprint Generation
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderStage() {
    switch (stage) {
      case 0: return renderSetup()
      case 1: return renderInventory()
      case 2: return renderVmware()
      case 3: return renderRequirements()
      case 4: return renderScoring()
      case 5: return renderBlueprint()
      default: return renderSetup()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!client) {
    return (
      <div className="cm-no-client">
        <Cloud size={32} />
        <p>Select a client to begin the Cloud Modernization assessment.</p>
      </div>
    )
  }

  return (
    <div className="cm-page">
      <div className="cm-header">
        <div className="cm-header-left">
          <div className="cm-header-icon"><Cloud size={20} /></div>
          <div>
            <h2 className="cm-title">Cloud Modernization</h2>
            <p className="cm-subtitle">{client.name} · Zones Compass</p>
          </div>
        </div>
        {hasResults && (
          <div className="cm-results-banner">
            <CheckCircle size={14} />
            Results saved — <button className="cm-results-link" onClick={() => setStage(blueprint ? 5 : 4)}>View blueprint</button>
          </div>
        )}
      </div>

      {/* Progress stepper */}
      <div className="cm-stepper">
        {STAGES.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              className={`cm-step ${i === stage ? 'cm-step-active' : ''} ${i < stage ? 'cm-step-done' : ''}`}
              onClick={() => i <= stage && setStage(i)}
            >
              <div className="cm-step-icon"><Icon size={14} /></div>
              <span className="cm-step-label">{s.label}</span>
              {i < STAGES.length - 1 && <div className="cm-step-connector" />}
            </button>
          )
        })}
      </div>

      <div className="cm-content">
        {renderStage()}
      </div>
    </div>
  )
}
