import { useState, useEffect, useRef } from 'react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from '../components/ChatVisual.jsx'
import {
  Cloud, Upload, Calculator, ClipboardList, Map, CheckCircle,
  Loader, AlertCircle, AlertTriangle, ArrowRight, Plus, X, FileText
} from 'lucide-react'
import './CloudModernization.css'

const API = import.meta.env.VITE_API_URL || ''

const STAGES = [
  { id: 'setup',        label: 'Setup'       },
  { id: 'inventory',    label: 'Workloads'   },
  { id: 'vmware',       label: 'VMware & Cost'},
  { id: 'requirements', label: 'Requirements'},
  { id: 'scoring',      label: 'Assessment'  },
  { id: 'blueprint',    label: 'Blueprint'   },
]

const SIX_R_COLORS = {
  Rehost:     '#4A9FE0',
  Replatform: '#8B5CF6',
  Refactor:   '#3DBA7E',
  Repurchase: '#E8A838',
  Retire:     '#E05A4E',
  Retain:     '#6B7280',
}

const PRIMARY_DRIVERS = [
  'VMware cost pressure / Broadcom licensing',
  'End-of-life OS or applications',
  'Cloud mandate from leadership',
  'Cost optimization',
  'Developer velocity',
  'Security and compliance posture',
  'Data center exit / lease expiry',
  'All of the above',
]

const TARGET_CLOUDS   = ['Azure', 'AWS', 'Google Cloud', 'Multi-Cloud']
const TIMELINES       = ['6 months', '12 months', '18 months', '24 months', '36+ months']
const WORKLOAD_TYPES  = ['Web Application', 'Database', 'File Server', 'Custom App', 'ERP/CRM', 'Analytics', 'Dev/Test', 'Other']
const PLATFORMS       = ['VMware vSphere', 'Hyper-V', 'Physical/Bare Metal', 'AWS', 'Azure', 'GCP', 'Other On-Prem']
const CRITICALITY     = ['Critical', 'High', 'Medium', 'Low']
const CHANGE_SENSITIVITY = ['Low', 'Medium', 'High', 'Very High']
const DATA_RESIDENCY     = ['US Only', 'EU Only', 'Global OK', 'Sovereign Required']
const COMPLIANCE_OPTIONS = ['PCI-DSS', 'HIPAA', 'SOC 2', 'ISO 27001', 'FedRAMP', 'GDPR', 'CCPA', 'ITAR']
const NETWORK_ARCHS      = ['Hub-Spoke', 'Flat/Peered', 'Zero Trust', 'SD-WAN']

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}K`
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

  const [stage,      setStage]      = useState(0)
  const [hasResults, setHasResults] = useState(false)

  // Stage 0 — Setup
  const [mode,          setMode]          = useState('linked')
  const [primaryDriver, setPrimaryDriver] = useState('')
  const [targetCloud,   setTargetCloud]   = useState('Azure')
  const [timeline,      setTimeline]      = useState('12 months')
  const [budgetRange,   setBudgetRange]   = useState('')
  const [constraints,   setConstraints]   = useState('')

  // Stage 1 — Inventory
  const [workloads,  setWorkloads]  = useState([emptyWorkload()])
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvError,   setCsvError]   = useState('')

  // Stage 2 — VMware
  const [vmwareCount,     setVmwareCount]     = useState('')
  const [vmwareVcpu,      setVmwareVcpu]      = useState('')
  const [vmwareRamGb,     setVmwareRamGb]     = useState('')
  const [vmwareStorageTb, setVmwareStorageTb] = useState('')
  const [vmwareCostMonth, setVmwareCostMonth] = useState('')
  const [calcLoading,     setCalcLoading]     = useState(false)
  const [calcResult,      setCalcResult]      = useState(null)
  const [calcError,       setCalcError]       = useState('')

  // Stage 3 — Requirements
  const [complianceReqs,  setComplianceReqs]  = useState([])
  const [networkArch,     setNetworkArch]     = useState('Hub-Spoke')
  const [haRequirement,   setHaRequirement]   = useState(false)
  const [drRequirement,   setDrRequirement]   = useState(false)
  const [managedServices, setManagedServices] = useState(true)
  const [additionalReqs,  setAdditionalReqs]  = useState('')

  // Stage 4 — 6R Scoring
  const [scoringLoading, setScoringLoading] = useState(false)
  const [scoringResult,  setScoringResult]  = useState(null)
  const [scoringError,   setScoringError]   = useState('')

  // Stage 5 — Blueprint
  const [bpLoading, setBpLoading] = useState(false)
  const [blueprint, setBlueprint] = useState(null)
  const [bpError,   setBpError]   = useState('')

  // ── Restore stored results ───────────────────────────────────────────────────
  useEffect(() => {
    if (!client) return
    fetch(`${API}/api/cloud-modernization/clients/${client.id}/cloud-modernization`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.workloads?.length)  setWorkloads(data.workloads)
        if (data.targetCloud)        setTargetCloud(data.targetCloud)
        if (data.timeline)           setTimeline(data.timeline)
        if (data.budgetRange)        setBudgetRange(data.budgetRange)
        if (data.constraints)        setConstraints(data.constraints)
        if (data.calcResult)         setCalcResult(data.calcResult)
        if (data.scoringResult)      setScoringResult(data.scoringResult)
        if (data.blueprint)          setBlueprint(data.blueprint)
        if (data.blueprint) { setHasResults(true); setStage(5) }
        else if (data.scoringResult) { setHasResults(true); setStage(4) }
      })
      .catch(() => {})
  }, [client?.id])

  // ── Auto-sync VMware inputs from inventory ───────────────────────────────────
  useEffect(() => {
    const vmWks = workloads.filter(w =>
      w.platform?.toLowerCase().includes('vmware') ||
      w.platform?.toLowerCase().includes('vsphere')
    )
    if (vmWks.length > 0) {
      setVmwareCount(String(vmWks.length))
      const totalVcpu    = vmWks.reduce((s, w) => s + (parseFloat(w.vcpu)      || 0), 0)
      const totalRam     = vmWks.reduce((s, w) => s + (parseFloat(w.ramGb)     || 0), 0)
      const totalStorage = vmWks.reduce((s, w) => s + (parseFloat(w.storageTb) || 0), 0)
      if (totalVcpu    > 0) setVmwareVcpu(String(totalVcpu))
      if (totalRam     > 0) setVmwareRamGb(String(totalRam))
      if (totalStorage > 0) setVmwareStorageTb(String(totalStorage))
    }
  }, [workloads])

  // ── CSV ──────────────────────────────────────────────────────────────────────
  async function parseCsv(file) {
    setCsvError(''); setCsvParsing(true); setCsvPreview(null)
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
    } catch (e) { setCsvError(e.message) }
    finally     { setCsvParsing(false) }
  }

  function acceptCsvImport() {
    if (!csvPreview) return
    setWorkloads(prev => [
      ...prev.filter(w => w.name),
      ...csvPreview.map(w => ({ ...emptyWorkload(), ...w, id: Date.now() + Math.random() })),
    ])
    setCsvPreview(null)
  }

  function addWorkload()                         { setWorkloads(prev => [...prev, emptyWorkload()]) }
  function updateWorkload(id, field, value)      { setWorkloads(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w)) }
  function removeWorkload(id)                    { setWorkloads(prev => prev.filter(w => w.id !== id)) }

  // ── VMware calculator ────────────────────────────────────────────────────────
  async function runCalculator() {
    setCalcError(''); setCalcLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/vmware-calculator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vmCount:     parseInt(vmwareCount)     || 0,
          vcpu:        parseFloat(vmwareVcpu)    || 0,
          ramGb:       parseFloat(vmwareRamGb)   || 0,
          storageTb:   parseFloat(vmwareStorageTb) || 0,
          currentCost: parseFloat(vmwareCostMonth) || 0,
        }),
      })
      if (!res.ok) throw new Error('Calculator failed')
      setCalcResult(await res.json())
    } catch (e) { setCalcError(e.message) }
    finally     { setCalcLoading(false) }
  }

  // ── 6R Scoring ───────────────────────────────────────────────────────────────
  async function runScoring() {
    if (!client) return
    setScoringError(''); setScoringLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/score-workloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, workloads, targetCloud, constraints, complianceReqs, haRequirement, drRequirement }),
      })
      if (!res.ok) throw new Error('Scoring failed')
      const data = await res.json()
      setScoringResult(data)
      setHasResults(true)
    } catch (e) { setScoringError(e.message) }
    finally     { setScoringLoading(false) }
  }

  // ── Blueprint ────────────────────────────────────────────────────────────────
  async function generateBlueprint() {
    if (!client) return
    setBpError(''); setBpLoading(true)
    try {
      const res = await fetch(`${API}/api/cloud-modernization/blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id, workloads, scoringResult, calcResult,
          targetCloud, timeline, budgetRange, constraints,
          complianceReqs, haRequirement, drRequirement, managedServices, networkArch, additionalReqs,
        }),
      })
      if (!res.ok) throw new Error('Blueprint generation failed')
      setBlueprint(await res.json())
    } catch (e) { setBpError(e.message) }
    finally     { setBpLoading(false) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function toggleCompliance(opt) {
    setComplianceReqs(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])
  }

  // ── Stage renderers ──────────────────────────────────────────────────────────

  function renderSetup() {
    const vmwareDriver = primaryDriver.includes('VMware') || primaryDriver.includes('Broadcom')
    return (
      <div>
        <div className="cm-section-title">Session setup</div>
        <div className="cm-section-sub">Configure the engagement type and migration driver before building your workload inventory.</div>

        {/* Engagement type */}
        <div className="cm-field-group">
          <label className="cm-label">Engagement type</label>
          <div className="cm-option-cards">
            <button className={`cm-option-card ${mode === 'linked' ? 'selected' : ''}`} onClick={() => setMode('linked')}>
              <div className="coc-icon">🔗</div>
              <div className="coc-title">Linked to client</div>
              <div className="coc-desc">Ties results to {client?.name || 'selected client'} — feeds into the AI Advisory assessment</div>
            </button>
            <button className={`cm-option-card ${mode === 'standalone' ? 'selected' : ''}`} onClick={() => setMode('standalone')}>
              <div className="coc-icon">☁️</div>
              <div className="coc-title">Standalone session</div>
              <div className="coc-desc">Infrastructure-only engagement — no advisory assessment required</div>
            </button>
          </div>
        </div>

        {/* Primary driver */}
        <div className="cm-field-group">
          <label className="cm-label">Primary migration driver</label>
          <div className="cm-option-pills">
            {PRIMARY_DRIVERS.map(d => (
              <button
                key={d}
                className={`cm-pill ${primaryDriver === d ? 'selected' : ''}`}
                onClick={() => setPrimaryDriver(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {vmwareDriver && (
          <div className="cm-vmware-alert">
            <AlertTriangle size={16} />
            <div>
              <div className="cva-title">VMware / Broadcom licensing detected</div>
              <div className="cva-desc">The licensing calculator in Stage 3 will quantify current spend and compare Azure VMware Solution (AVS), Azure IaaS, and Nutanix alternatives.</div>
            </div>
          </div>
        )}

        {/* Target cloud + timeline pills */}
        <div className="cm-field-group">
          <label className="cm-label">Target cloud platform</label>
          <div className="cm-option-pills">
            {TARGET_CLOUDS.map(c => (
              <button key={c} className={`cm-pill ${targetCloud === c ? 'selected' : ''}`} onClick={() => setTargetCloud(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="cm-field-group">
          <label className="cm-label">Migration timeline</label>
          <div className="cm-option-pills">
            {TIMELINES.map(t => (
              <button key={t} className={`cm-pill ${timeline === t ? 'selected' : ''}`} onClick={() => setTimeline(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="cm-field-group">
          <label className="cm-label">Budget range <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--z-muted)' }}>(optional)</span></label>
          <input
            className="cm-input"
            type="text"
            placeholder="e.g. $500K – $2M"
            value={budgetRange}
            onChange={e => setBudgetRange(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        <div className="cm-field-group">
          <label className="cm-label">Key constraints</label>
          <textarea
            className="cm-input"
            rows={3}
            placeholder="Compliance requirements, network restrictions, legacy dependencies, vendor contracts…"
            value={constraints}
            onChange={e => setConstraints(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="cm-stage-footer">
          <div />
          <div className="cm-footer-actions">
            <button
              className="cm-btn-primary"
              onClick={() => setStage(1)}
              disabled={!primaryDriver}
            >
              Start workload inventory <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderInventory() {
    const vmwareCount_computed = workloads.filter(w =>
      w.platform?.toLowerCase().includes('vmware') || w.platform?.toLowerCase().includes('vsphere')
    ).length

    return (
      <div>
        <div className="cm-section-title">Workload inventory</div>
        <div className="cm-section-sub">Add workloads manually or import from a CSV export. Each workload will receive a 6R migration recommendation.</div>

        <div className="cm-inventory-actions">
          <button className="cm-btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => e.target.files[0] && parseCsv(e.target.files[0])}
          />
          {csvParsing && (
            <span style={{ fontSize: 12, color: 'var(--z-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--z-border)', borderTopColor: 'var(--z-blue-bright)', borderRadius: '50%' }} /> Parsing…
            </span>
          )}
          {csvError && <span style={{ fontSize: 12, color: '#E05A4E', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={13} /> {csvError}</span>}
          {vmwareCount_computed > 0 && (
            <span className="cm-vmware-count-badge">
              {vmwareCount_computed} VMware workload{vmwareCount_computed !== 1 ? 's' : ''} detected — auto-populated in Stage 3
            </span>
          )}
        </div>

        {csvPreview && (
          <div className="cm-csv-panel">
            <div className="cm-csv-header">
              <div>
                <div className="cm-csv-title">{csvPreview.length} workloads found in CSV</div>
                <div className="cm-csv-sub">Review the import below, then accept to add to inventory.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cm-btn-primary small" onClick={acceptCsvImport}>Accept import</button>
                <button className="cm-btn-ghost" onClick={() => setCsvPreview(null)}>Cancel</button>
              </div>
            </div>
            <div className="cm-csv-preview">
              <div className="cm-csv-preview-title">Preview (first {Math.min(csvPreview.length, 5)})</div>
              <div className="cm-csv-preview-grid">
                {csvPreview.slice(0, 5).map((w, i) => (
                  <div key={i} className="cm-csv-preview-row">
                    <span className="cm-csv-name">{w.name || `Workload ${i + 1}`}</span>
                    <span className="cm-csv-type">{w.type}</span>
                    <span className="cm-csv-os">{w.platform}</span>
                    <span className="cm-csv-size">{w.vcpu && `${w.vcpu} vCPU`}{w.ramGb && ` · ${w.ramGb} GB`}</span>
                  </div>
                ))}
              </div>
              {csvPreview.length > 5 && <div className="cm-csv-more">…and {csvPreview.length - 5} more workloads</div>}
            </div>
          </div>
        )}

        <div className="cm-workload-list">
          {workloads.map(w => (
            <div
              key={w.id}
              className={`cm-workload-card ${w.platform?.includes('VMware') ? 'imported' : ''}`}
            >
              <div className="cwc-header">
                <div className="cwc-name-row">
                  <div className="cwc-name">{w.name || <span style={{ color: 'var(--z-muted)' }}>Unnamed workload</span>}</div>
                  {(w.platform?.includes('VMware') || w.platform?.includes('vSphere')) && (
                    <span className="cwc-platform-tag vmware">VMware</span>
                  )}
                </div>
                <button className="cm-icon-btn" onClick={() => removeWorkload(w.id)}><X size={12} /></button>
              </div>
              <div className="cwc-fields">
                <input
                  className="cwc-input large"
                  type="text"
                  placeholder="Workload name (e.g. CRM Database)"
                  value={w.name}
                  onChange={e => updateWorkload(w.id, 'name', e.target.value)}
                />
                <select className="cwc-select" value={w.type} onChange={e => updateWorkload(w.id, 'type', e.target.value)}>
                  {WORKLOAD_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select className="cwc-select" value={w.platform} onChange={e => updateWorkload(w.id, 'platform', e.target.value)}>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
                <div className="cwc-size-row">
                  <input className="cwc-size-input" type="number" placeholder="vCPU" value={w.vcpu}      onChange={e => updateWorkload(w.id, 'vcpu', e.target.value)} />
                  <input className="cwc-size-input" type="number" placeholder="GB RAM" value={w.ramGb}   onChange={e => updateWorkload(w.id, 'ramGb', e.target.value)} />
                  <input className="cwc-size-input" type="number" placeholder="TB storage" step="0.1" value={w.storageTb} onChange={e => updateWorkload(w.id, 'storageTb', e.target.value)} />
                </div>
                <select className="cwc-select" value={w.criticality} onChange={e => updateWorkload(w.id, 'criticality', e.target.value)}>
                  {CRITICALITY.map(c => <option key={c}>{c}</option>)}
                </select>
                <select className="cwc-select" value={w.changeSensitivity} onChange={e => updateWorkload(w.id, 'changeSensitivity', e.target.value)}>
                  {CHANGE_SENSITIVITY.map(c => <option key={c}>{c}</option>)}
                </select>
                <select className="cwc-select" value={w.dataResidency} onChange={e => updateWorkload(w.id, 'dataResidency', e.target.value)}>
                  {DATA_RESIDENCY.map(d => <option key={d}>{d}</option>)}
                </select>
                <input className="cwc-input" type="text" placeholder="Notes / dependencies…" value={w.notes} onChange={e => updateWorkload(w.id, 'notes', e.target.value)} style={{ gridColumn: '1/-1' }} />
              </div>
            </div>
          ))}
        </div>

        <button className="cm-add-btn" onClick={addWorkload}>
          <Plus size={14} /> Add workload
        </button>

        <div className="cm-stage-footer">
          <button className="cm-btn-ghost" onClick={() => setStage(0)}>← Back</button>
          <div className="cm-footer-actions">
            <span className="cm-count">{workloads.filter(w => w.name).length} workload{workloads.filter(w => w.name).length !== 1 ? 's' : ''} named</span>
            <button
              className="cm-btn-primary"
              onClick={() => setStage(2)}
              disabled={workloads.filter(w => w.name).length === 0}
            >
              Next: VMware &amp; Cost <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderVmware() {
    const COMPARISON_ITEMS = [
      { key: 'current', label: 'Current VMware',      value: calcResult?.currentMonthly,  accent: '#E05A4E' },
      { key: 'avs',     label: 'Azure VMware (AVS)',  value: calcResult?.avsMonthly,       accent: '#4A9FE0' },
      { key: 'iaas',    label: 'Azure IaaS',          value: calcResult?.iaasMonthly,      accent: '#3DBA7E', recommended: true },
      { key: 'nutanix', label: 'Nutanix',             value: calcResult?.nutanixMonthly,   accent: '#8B5CF6' },
    ]

    return (
      <div>
        <div className="cm-section-title">VMware &amp; cost comparison</div>
        <div className="cm-section-sub">Compare your current VMware environment against Azure VMware Solution (AVS), native Azure IaaS, and Nutanix. Auto-populated from VMware workloads in your inventory.</div>

        <div className="cm-calc-grid">
          <div className="cm-calc-inputs">
            <div className="cm-calc-input-group">
              <label className="cm-label">VM count</label>
              <input className="cm-input" type="number" placeholder="0" value={vmwareCount} onChange={e => setVmwareCount(e.target.value)} />
            </div>
            <div className="cm-calc-input-group">
              <label className="cm-label">Total vCPU</label>
              <input className="cm-input" type="number" placeholder="0" value={vmwareVcpu} onChange={e => setVmwareVcpu(e.target.value)} />
            </div>
            <div className="cm-calc-input-group">
              <label className="cm-label">Total RAM (GB)</label>
              <input className="cm-input" type="number" placeholder="0" value={vmwareRamGb} onChange={e => setVmwareRamGb(e.target.value)} />
            </div>
            <div className="cm-calc-input-group">
              <label className="cm-label">Total storage (TB)</label>
              <input className="cm-input" type="number" placeholder="0" step="0.1" value={vmwareStorageTb} onChange={e => setVmwareStorageTb(e.target.value)} />
            </div>
            <div className="cm-calc-input-group">
              <label className="cm-label">Current monthly cost ($)</label>
              <input className="cm-input" type="number" placeholder="0" value={vmwareCostMonth} onChange={e => setVmwareCostMonth(e.target.value)} />
            </div>
            <button className="cm-btn-primary" onClick={runCalculator} disabled={calcLoading} style={{ marginTop: 4 }}>
              {calcLoading
                ? <><span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Calculating…</>
                : <><Calculator size={14} /> Run comparison</>
              }
            </button>
            {calcError && <div style={{ fontSize: 12, color: '#E05A4E', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} /> {calcError}</div>}
          </div>

          <div>
            {calcResult ? (
              <>
                <div className="cm-calc-results-title">Monthly cost comparison</div>
                {calcResult.currentMonthly > 0 && (
                  <div className="cm-calc-estimate-note">
                    Based on {formatCurrency(calcResult.currentMonthly)}/mo current spend · {calcResult.avsNodes} AV36P nodes required for AVS
                  </div>
                )}
                <div className="cm-comparison-cards">
                  {COMPARISON_ITEMS.map(item => {
                    const saving   = (calcResult.currentMonthly || 0) - (item.value || 0)
                    const positive = saving > 0
                    return (
                      <div
                        key={item.key}
                        className={`cm-compare-card ${item.key === 'current' ? 'current' : ''}`}
                        style={item.recommended ? { borderColor: 'rgba(61,186,126,.4)', background: 'rgba(61,186,126,.04)' } : {}}
                      >
                        {item.recommended && (
                          <div style={{ fontSize: 10, color: '#3DBA7E', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Recommended</div>
                        )}
                        <div className="ccc-label">{item.label}</div>
                        <div className="ccc-annual">
                          {item.value != null ? formatCurrency(item.value) : '—'}
                          <span>/mo</span>
                        </div>
                        {item.key !== 'current' && item.value != null && saving !== 0 && (
                          <div className={`ccc-saving ${positive ? 'positive' : 'negative'}`}>
                            {positive ? '↓' : '↑'} {formatCurrency(Math.abs(saving))}/mo vs current
                          </div>
                        )}
                        {item.key === 'avs' && calcResult.avsNodes && (
                          <div className="ccc-nodes">{calcResult.avsNodes} AV36P nodes</div>
                        )}
                        {item.value != null && (
                          <div className="ccc-tco3">{formatCurrency((item.value || 0) * 36)} over 3 yrs</div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {calcResult.recommendation && (
                  <div className="cm-summary-card">{calcResult.recommendation}</div>
                )}
                <div className="cm-calc-disclaimer">Estimates based on public pricing. AVS: AV36P nodes at ~$7,200/node/month, min 3 nodes. Azure IaaS and Nutanix estimates use industry benchmark ratios.</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 160, color: 'var(--z-muted)', fontSize: 13, flexDirection: 'column', gap: 8 }}>
                <Calculator size={28} style={{ opacity: 0.3 }} />
                <span>Enter inputs and run comparison</span>
              </div>
            )}
          </div>
        </div>

        <div className="cm-stage-footer" style={{ marginTop: 24 }}>
          <button className="cm-btn-ghost" onClick={() => setStage(1)}>← Back</button>
          <button className="cm-btn-primary" onClick={() => setStage(3)}>
            Next: Requirements <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderRequirements() {
    return (
      <div>
        <div className="cm-section-title">Migration requirements</div>
        <div className="cm-section-sub">Define compliance, availability, and architecture requirements that will shape 6R scoring and the migration blueprint.</div>

        <div className="cm-field-group">
          <label className="cm-label">Compliance frameworks</label>
          <div className="cm-option-pills">
            {COMPLIANCE_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`cm-pill ${complianceReqs.includes(opt) ? 'selected' : ''}`}
                onClick={() => toggleCompliance(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-field-group">
          <label className="cm-label">Network architecture</label>
          <div className="cm-option-pills">
            {NETWORK_ARCHS.map(n => (
              <button key={n} className={`cm-pill ${networkArch === n ? 'selected' : ''}`} onClick={() => setNetworkArch(n)}>{n}</button>
            ))}
          </div>
        </div>

        <div className="cm-field-group">
          <label className="cm-label">Availability &amp; resilience</label>
          <div className="cm-option-pills">
            {[
              { label: 'High Availability', value: haRequirement, toggle: () => setHaRequirement(v => !v) },
              { label: 'Disaster Recovery', value: drRequirement, toggle: () => setDrRequirement(v => !v) },
              { label: 'Prefer Managed Services (PaaS)', value: managedServices, toggle: () => setManagedServices(v => !v) },
            ].map(item => (
              <button
                key={item.label}
                className={`cm-pill ${item.value ? 'selected' : ''}`}
                onClick={item.toggle}
              >
                {item.value ? '✓ ' : ''}{item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-req-field">
          <label className="cm-label">Additional requirements</label>
          <textarea
            className="cm-input"
            rows={3}
            placeholder="Latency requirements, vendor preferences, integration constraints, geographic restrictions…"
            value={additionalReqs}
            onChange={e => setAdditionalReqs(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="cm-stage-footer">
          <button className="cm-btn-ghost" onClick={() => setStage(2)}>← Back</button>
          <button className="cm-btn-primary" onClick={() => { setStage(4); runScoring() }}>
            Run 6R analysis <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderScoring() {
    // Group workloads by 6R recommendation for wave sections
    const grouped = scoringResult?.workloads?.reduce((acc, w) => {
      const r = w.recommendation || 'Unknown'
      if (!acc[r]) acc[r] = []
      acc[r].push(w)
      return acc
    }, {}) || {}

    const rDist = scoringResult?.workloads?.reduce((acc, w) => {
      acc[w.recommendation] = (acc[w.recommendation] || 0) + 1
      return acc
    }, {}) || {}

    const effortPct = (e) => {
      if (!e) return 0
      const m = { Low: 25, Medium: 55, High: 85, 'Very High': 100 }
      return m[e] ?? 50
    }
    const riskPct = (r) => {
      if (!r) return 0
      const m = { Low: 25, Medium: 55, High: 85 }
      return m[r] ?? 50
    }

    return (
      <div>
        <div className="cm-section-title">6R migration assessment</div>
        <div className="cm-section-sub">AI-powered classification of each workload into the 6R framework: Rehost, Replatform, Refactor, Repurchase, Retire, or Retain.</div>

        {scoringLoading && (
          <div className="cm-loading">
            <Loader size={20} style={{ animation: 'cm-spin 1s linear infinite' }} />
            Analyzing {workloads.filter(w => w.name).length} workloads against the 6R framework…
          </div>
        )}

        {scoringError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E05A4E', padding: '12px 16px', background: 'rgba(224,90,78,.08)', borderRadius: 6, marginBottom: 16 }}>
            <AlertCircle size={14} /> {scoringError}
          </div>
        )}

        {scoringResult && (
          <>
            {/* Distribution pills */}
            <div className="cm-r-distribution">
              {Object.entries(rDist).map(([r, count]) => (
                <div
                  key={r}
                  className="cm-r-chip"
                  style={{ color: SIX_R_COLORS[r], borderColor: SIX_R_COLORS[r] + '55', background: SIX_R_COLORS[r] + '11' }}
                >
                  <span className="cm-r-count">{count}</span> {r}
                </div>
              ))}
            </div>

            {/* Wave sections per 6R category */}
            {Object.entries(grouped).map(([r, wls]) => (
              <div key={r} className="cm-wave-section">
                <div
                  className="cm-wave-header"
                  style={{ borderLeftColor: SIX_R_COLORS[r], color: SIX_R_COLORS[r] }}
                >
                  <div className="cm-wave-label">{r}</div>
                  <div className="cm-wave-count">{wls.length} workload{wls.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="cm-workload-score-grid">
                  {wls.map((w, i) => (
                    <div key={i} className="cm-scored-card">
                      <div className="csc-header">
                        <div className="csc-name">{w.name}</div>
                        <div
                          className="csc-r-badge"
                          style={{ background: SIX_R_COLORS[r] + '22', color: SIX_R_COLORS[r] }}
                        >
                          {r}
                        </div>
                      </div>
                      <div className="csc-rationale">{w.rationale}</div>
                      <div className="csc-scores">
                        <div className="csc-score">
                          <span>Effort</span>
                          <div className="csc-bar"><div style={{ width: `${effortPct(w.effort)}%`, background: '#4A9FE0' }} /></div>
                          <span>{w.effort}</span>
                        </div>
                        <div className="csc-score">
                          <span>Risk</span>
                          <div className="csc-bar"><div style={{ width: `${riskPct(w.risk)}%`, background: w.risk === 'High' ? '#E05A4E' : '#E8A838' }} /></div>
                          <span>{w.risk}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {scoringResult.summary && (
              <div className="cm-summary-card" style={{ marginTop: 8 }}>{scoringResult.summary}</div>
            )}
          </>
        )}

        <div className="cm-stage-footer">
          <button className="cm-btn-ghost" onClick={() => setStage(3)}>← Back</button>
          <div className="cm-footer-actions">
            {!scoringResult && !scoringLoading && (
              <button className="cm-btn-secondary" onClick={runScoring}>Retry analysis</button>
            )}
            <button
              className="cm-btn-primary"
              onClick={() => { setStage(5); generateBlueprint() }}
              disabled={!scoringResult || bpLoading}
            >
              Generate blueprint <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderBlueprint() {
    return (
      <div>
        <div className="cm-bp-header">
          <div>
            <div className="cm-section-title">Migration blueprint</div>
            <div className="cm-section-sub">Phased migration plan with architecture recommendations, risk mitigation guidance, and cost estimates.</div>
          </div>
          <div className="cm-bp-actions">
            {blueprint && <span className="cm-saved-badge">✓ Saved</span>}
          </div>
        </div>

        {bpLoading && (
          <div className="cm-loading">
            <Loader size={20} style={{ animation: 'cm-spin 1s linear infinite' }} />
            Generating migration blueprint for {workloads.filter(w => w.name).length} workloads…
          </div>
        )}

        {bpError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E05A4E', padding: '12px 16px', background: 'rgba(224,90,78,.08)', borderRadius: 6, marginBottom: 16 }}>
            <AlertCircle size={14} /> {bpError}
          </div>
        )}

        {blueprint && (
          <div>
            {blueprint.summary && (
              <div className="cm-summary-card" style={{ marginBottom: 20 }}>{blueprint.summary}</div>
            )}

            {blueprint.phases?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="cm-findings-title">Migration phases</div>
                {blueprint.phases.map((phase, i) => (
                  <div
                    key={i}
                    className="cm-wave-section"
                    style={{ marginBottom: 12 }}
                  >
                    <div
                      className="cm-wave-header"
                      style={{ borderLeftColor: ['#4A9FE0', '#8B5CF6', '#3DBA7E', '#E8A838'][i % 4] }}
                    >
                      <div className="cm-wave-label" style={{ color: ['#4A9FE0', '#8B5CF6', '#3DBA7E', '#E8A838'][i % 4] }}>
                        Phase {i + 1} — {phase.name}
                      </div>
                      <div className="cm-wave-count">{phase.timeline}</div>
                    </div>
                    <div style={{ paddingLeft: 12 }}>
                      {phase.workloads?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {phase.workloads.map((w, j) => (
                            <span key={j} style={{ fontSize: 11, background: 'var(--z-surface)', border: '.5px solid var(--z-border)', borderRadius: 4, padding: '2px 8px', color: 'var(--z-white)' }}>{w}</span>
                          ))}
                        </div>
                      )}
                      {phase.actions?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--z-muted)', lineHeight: 1.8 }}>
                          {phase.actions.map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {blueprint.risks?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="cm-findings-title">Risk mitigation</div>
                {blueprint.risks.map((r, i) => (
                  <div key={i} style={{ background: 'var(--z-surface)', border: '.5px solid var(--z-border)', borderLeft: '3px solid #E8A838', borderRadius: '0 6px 6px 0', padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
                    <strong style={{ color: 'var(--z-white)' }}>{r.risk}</strong>
                    <div style={{ color: 'var(--z-muted)', fontSize: 12, marginTop: 4 }}>{r.mitigation}</div>
                  </div>
                ))}
              </div>
            )}

            {blueprint.architectureNotes && (
              <div style={{ marginBottom: 20 }}>
                <div className="cm-findings-title">Architecture notes</div>
                <div className="cm-summary-card">{blueprint.architectureNotes}</div>
              </div>
            )}

            {blueprint.estimatedCost && (
              <div style={{ marginBottom: 20 }}>
                <div className="cm-findings-title">Cost estimate</div>
                <div className="cm-summary-card" style={{ borderLeftColor: '#3DBA7E' }}>{blueprint.estimatedCost}</div>
              </div>
            )}

            {blueprint.visuals?.length > 0 && (
              <div className="cm-visual-section">
                <div className="cm-findings-title">Architecture diagram</div>
                {blueprint.visuals.map((v, i) => <ChatVisual key={i} visual={v} />)}
              </div>
            )}
          </div>
        )}

        <div className="cm-stage-footer">
          <button className="cm-btn-ghost" onClick={() => setStage(4)}>← Back to scoring</button>
          {!bpLoading && !blueprint && (
            <button className="cm-btn-primary" onClick={generateBlueprint}>Retry blueprint generation</button>
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

  // ── No client state ──────────────────────────────────────────────────────────
  if (!client) {
    return (
      <div className="cm-empty-blueprint">
        <Cloud size={32} style={{ opacity: 0.3 }} />
        <span>Select a client to begin the Cloud Modernization assessment.</span>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="cm-page">

      {/* Header */}
      <div className="cm-page-header">
        <div className="cm-brand">
          <Cloud size={18} color="#4A9FE0" />
          <div>
            <div className="cm-brand-name">Zones Compass</div>
            <div className="cm-brand-module">Cloud Modernization</div>
          </div>
        </div>
        <div className="cm-client-badge">{client.name}</div>
      </div>

      {/* Results banner */}
      {hasResults && (
        <div className="cm-results-banner">
          <div className="cm-rb-left">
            <div className="cm-rb-title">
              <CheckCircle size={14} color="#3DBA7E" />
              Results saved
              <span className="cm-rb-count">{workloads.filter(w => w.name).length} workloads</span>
            </div>
            <div className="cm-rb-sub">Previous session restored — continue where you left off</div>
          </div>
          <div className="cm-rb-actions">
            {scoringResult && <button className="cm-btn-ghost" onClick={() => setStage(4)}>View scoring</button>}
            {blueprint     && <button className="cm-btn-primary small" onClick={() => setStage(5)}>View blueprint</button>}
          </div>
        </div>
      )}

      {/* Progress stepper */}
      <div className="cm-progress">
        <div className="cm-progress-track">
          <div className="cm-progress-fill" style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }} />
        </div>
        {STAGES.map((s, i) => (
          <div
            key={s.id}
            className={`cm-stage-step ${i === stage ? 'active' : ''} ${i < stage ? 'done' : ''}`}
            onClick={() => i < stage && setStage(i)}
            style={{ cursor: i < stage ? 'pointer' : 'default' }}
          >
            <div className="cm-step-dot">{i < stage ? '✓' : i + 1}</div>
            <div className="cm-step-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stage content */}
      <div className="cm-content">
        {renderStage()}
      </div>
    </div>
  )
}
