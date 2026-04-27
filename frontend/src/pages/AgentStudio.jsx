import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Zap, X, Loader, Download, Plus, ChevronRight } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from '../components/ChatVisual.jsx'
import EnvironmentProfile from '../components/EnvironmentProfile.jsx'
import { getStalenessStatus } from '../lib/staleness.js'
import {
  DEPLOYMENT_MODELS,
  CLOUD_TOOL_CATEGORIES,
  ON_PREM_CATEGORIES,
  LEGACY_CATEGORIES,
  COMPLIANCE_FRAMEWORKS,
  INDUSTRIES,
} from '../lib/environmentConstants.js'
import '../components/EnvironmentProfile.css'
import './AgentStudio.css'

const API = import.meta.env.VITE_API_URL || ''

const PILLAR_META = {
  governance: { label: 'Governance',       color: '#4A9FE0' },
  risk:       { label: 'Risk & Compliance', color: '#E8A838' },
  strategy:   { label: 'AI Strategy',      color: '#8B5CF6' },
  operations: { label: 'Operations',       color: '#3DBA7E' },
  enablement: { label: 'Enablement',       color: '#EC4899' },
}

const COMPLEXITY_META = {
  quick_win: { label: 'Quick Win', color: '#3DBA7E' },
  strategic: { label: 'Strategic', color: '#4A9FE0' },
  complex:   { label: 'Complex',   color: '#8B5CF6' },
}

const STATUS_META = {
  backlog:     { label: 'Backlog',     color: '#4A9FE0' },
  in_progress: { label: 'In Progress', color: '#E8A838' },
  deployed:    { label: 'Deployed',    color: '#3DBA7E' },
}

const fitColor = s => s >= 80 ? '#3DBA7E' : s >= 60 ? '#4A9FE0' : s >= 40 ? '#E8A838' : 'var(--z-muted)'

/* ── Shared ToolCategoryRow ───────────────────────────────────────────── */
function ToolCategoryRow({ cat, selected, catMap, addingCategory, addInputValue, setAddInputValue, onToggle, onAddCustom, onRemoveCustom, onStartAdding, sectionKey }) {
  const customInRow = selected.filter(t => catMap[t] === cat.id)
  const isAddingHere = addingCategory?.section === sectionKey && addingCategory?.catId === cat.id

  function commitAdd() {
    const val = addInputValue.trim()
    if (val && !selected.includes(val)) onAddCustom(cat.id, val)
    setAddInputValue('')
    onStartAdding(null)
  }

  return (
    <div className="tool-category">
      <div className="tool-category-label">{cat.label}</div>
      <div className="tool-chips-and-input">
        {cat.tools.map(tool => (
          <button
            key={tool}
            className={`tool-chip${selected.includes(tool) ? ' selected' : ''}`}
            onClick={() => onToggle(tool)}
          >
            {tool}
          </button>
        ))}
        {customInRow.map(tool => (
          <div key={tool} className="tool-chip selected custom-chip">
            {tool}
            <button className="chip-remove" onClick={() => onRemoveCustom(tool)}>×</button>
          </div>
        ))}
        {isAddingHere ? (
          <input
            className="other-tool-input"
            autoFocus
            placeholder="Tool name + Enter"
            value={addInputValue}
            onChange={e => setAddInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAdd()
              if (e.key === 'Escape') { onStartAdding(null); setAddInputValue('') }
            }}
            onBlur={commitAdd}
          />
        ) : (
          <button
            className="tool-add-btn"
            onClick={() => onStartAdding({ section: sectionKey, catId: cat.id })}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Agent Design Panel (slide-over) ──────────────────────────────────── */
function AgentDesignPanel({ agent, client, vertical, tools, onClose, onAddToBacklog }) {
  const [isOpen,         setIsOpen]         = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [reply,          setReply]          = useState('')
  const [visuals,        setVisuals]        = useState([])
  const [pdfLoading,     setPdfLoading]     = useState(false)
  const [addedToBacklog, setAddedToBacklog] = useState(false)
  const [fetchKey,       setFetchKey]       = useState(0)
  const panelRef = useRef(null)

  useEffect(() => { const t = setTimeout(() => setIsOpen(true), 10); return () => clearTimeout(t) }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setLoading(true); setReply(''); setVisuals([])
    fetch(`${API}/api/agents/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, clientName: client?.name, clientScores: client?.scores, vertical, tools }),
    })
      .then(r => r.json())
      .then(data => {
        console.log('Blueprint response:', data.reply?.slice(0, 100), 'visuals:', data.visuals?.length)
        const visualsToRender = data.visuals?.length ? data.visuals : data.visual ? [data.visual] : []
        setReply(data.reply || '')
        setVisuals(visualsToRender)
      })
      .catch(err => {
        console.error('Blueprint fetch error:', err)
        setReply('Connection error. Please check the backend is running.')
      })
      .finally(() => setLoading(false))
  }, [fetchKey])

  function handleClose() { setIsOpen(false); setTimeout(onClose, 300) }

  async function handleAddToBacklog() {
    if (addedToBacklog) return
    setAddedToBacklog(true)
    await onAddToBacklog?.(agent)
  }

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const PAGE_W = 210, PAGE_H = 297, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      pdf.setFillColor(10, 22, 40); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
      pdf.setFontSize(7); pdf.setTextColor(100, 130, 180)
      pdf.text('ZONES AI ADVISORY FRAMEWORK · AGENT BLUEPRINT', MARGIN, MARGIN + 4)
      pdf.setFontSize(16); pdf.setTextColor(244, 246, 250)
      pdf.text(`${agent.name}`, MARGIN, MARGIN + 16, { maxWidth: CONTENT_W })
      pdf.setFontSize(8); pdf.setTextColor(120, 150, 190)
      pdf.text(`${client?.name || 'Client'} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Confidential`, MARGIN, MARGIN + 26)
      pdf.setDrawColor(74, 159, 224); pdf.setLineWidth(0.5)
      pdf.line(MARGIN, MARGIN + 32, PAGE_W - MARGIN, MARGIN + 32)

      let yPos = MARGIN
      function addPageHeader() {
        pdf.setFontSize(7); pdf.setTextColor(100, 130, 180)
        pdf.text(`ZONES AGENT BLUEPRINT  ·  ${client?.name || ''}  ·  ${agent.name}`, MARGIN, 8)
        pdf.setDrawColor(74, 159, 224); pdf.setLineWidth(0.3)
        pdf.line(MARGIN, 10, PAGE_W - MARGIN, 10); yPos = 16
      }

      async function addElement(el) {
        if (!el) return
        el.scrollIntoView({ block: 'nearest' })
        await new Promise(r => setTimeout(r, 120))
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#0F2040', logging: false })
        const imgData = canvas.toDataURL('image/png')
        const rawH = (canvas.height / canvas.width) * CONTENT_W
        const maxH = PAGE_H - MARGIN * 2 - 6
        const imgH = Math.min(rawH, maxH)
        const imgW = rawH > maxH ? CONTENT_W * (maxH / rawH) : CONTENT_W
        if (yPos + imgH > PAGE_H - MARGIN) {
          pdf.addPage(); pdf.setFillColor(10, 22, 40); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F'); addPageHeader()
        }
        pdf.addImage(imgData, 'PNG', MARGIN, yPos, imgW, imgH); yPos += imgH + 5
      }

      pdf.addPage(); pdf.setFillColor(10, 22, 40); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F'); addPageHeader()
      const container = panelRef.current
      if (container) {
        const summaryEl = container.querySelector('.plan-summary')
        if (summaryEl) await addElement(summaryEl)
        for (const section of container.querySelectorAll('.action-plan-section')) {
          const narrativeEl = section.querySelector('.narrative-block')
          const visualEl    = section.querySelector('.chat-visual-wrapper')
          if (narrativeEl) await addElement(narrativeEl)
          if (visualEl)    await addElement(visualEl)
          yPos += 3
        }
      }

      const totalPages = pdf.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p); pdf.setFontSize(7); pdf.setTextColor(80, 110, 160)
        pdf.text(`${p} / ${totalPages}`, PAGE_W / 2, PAGE_H - 6, { align: 'center' })
        pdf.text('Confidential — Zones Innovation Center', MARGIN, PAGE_H - 6)
      }
      pdf.save(`${(client?.name || 'Client').replace(/[^a-z0-9]/gi, '-')}-${agent.name.replace(/[^a-z0-9]/gi, '-')}-Blueprint.pdf`)
    } catch (err) { console.error('PDF export failed:', err) }
    finally { setPdfLoading(false) }
  }

  const color = fitColor(agent.fit_score)

  return createPortal(
    <>
      <div className="ap-overlay" onClick={handleClose} />
      <div className={`ap-panel${isOpen ? ' open' : ''}`}>
        <div className="ap-header">
          <div className="ap-header-content">
            <div className="ap-title">⚡ {agent.name}</div>
            <div className="ap-subtitle">
              {client?.name}
              {agent.complexity && ` · ${COMPLEXITY_META[agent.complexity]?.label || agent.complexity}`}
              <span className="ap-scope-badge" style={{ background: color + '20', color, borderColor: color + '50' }}>
                {agent.fit_score}% fit
              </span>
            </div>
          </div>
          <button className="ap-close" onClick={handleClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="ap-body" ref={panelRef}>
          {loading ? (
            <div className="ap-loading">
              <Loader size={22} className="ap-spin" />
              <div className="ap-loading-text">Designing your agent blueprint…</div>
              <div className="ap-loading-sub">Building architecture, spec, and implementation plan</div>
            </div>
          ) : (
            <>
              <div className="plan-cover">
                <div className="plan-cover-brand">ZONES AI ADVISORY FRAMEWORK · AGENT BLUEPRINT</div>
                <div className="plan-cover-title">{agent.name}</div>
                <div className="plan-cover-meta">
                  {client?.name} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Confidential
                </div>
              </div>
              {reply && <div className="plan-summary"><div className="plan-summary-icon">⚡</div><p>{reply}</p></div>}
              {visuals.map((visual, i) => (
                <div key={i} className="action-plan-section">
                  {i > 0 && <div className="section-divider"><span className="section-num">0{i + 1}</span><div className="divider-line" /></div>}
                  {visual.narrative && (
                    <div className="narrative-block">
                      <div className="narrative-headline">{visual.narrative.headline}</div>
                      {visual.narrative.context && <p className="narrative-context">{visual.narrative.context}</p>}
                      {visual.narrative.actions?.length > 0 && (
                        <div className="narrative-callout">
                          <div className="callout-label">Key actions</div>
                          <ul>{visual.narrative.actions.map((a, j) => <li key={j}>{a}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="chat-visual-wrapper"><ChatVisual visual={visual} /></div>
                </div>
              ))}
              {!reply && visuals.length === 0 && (
                <div className="blueprint-error">
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontSize: 13, color: 'var(--z-white)', marginBottom: 4, fontWeight: 500 }}>Blueprint generation failed</div>
                  <div style={{ fontSize: 11, color: 'var(--z-muted)', marginBottom: 16, lineHeight: 1.6 }}>The AI response could not be parsed. This can happen when the response is truncated.</div>
                  <button className="studio-generate-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => setFetchKey(k => k + 1)}>
                    <Zap size={13} /> Try again
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && (visuals.length > 0 || reply) && (
          <div className="ap-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="ap-download"
              onClick={handleAddToBacklog}
              disabled={addedToBacklog}
              style={addedToBacklog ? { background: 'rgba(61,186,126,0.1)', borderColor: 'rgba(61,186,126,0.3)', color: '#3DBA7E' } : {}}
            >
              {addedToBacklog ? '✓ Added to Agent Backlog' : '+ Add to Agent Backlog'}
            </button>
            <button className="ap-download" onClick={downloadPDF} disabled={pdfLoading}>
              {pdfLoading ? <><Loader size={13} className="ap-spin" /> Generating PDF…</> : <><Download size={13} /> Download Blueprint PDF</>}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

/* ── Agent Card ───────────────────────────────────────────────────────── */
function AgentCard({ agent, onDesign }) {
  const pillar  = PILLAR_META[agent.pillar]        || { label: agent.pillar,      color: '#4A9FE0' }
  const complex = COMPLEXITY_META[agent.complexity] || { label: agent.complexity,  color: '#4A9FE0' }
  const color   = fitColor(agent.fit_score)

  return (
    <div className="agent-card">
      <div className="agent-card-top">
        <div className="fit-badge" style={{ background: color + '22', color, borderColor: color + '44' }}>
          {agent.fit_score}
        </div>
        <div className="agent-card-meta">
          <span className="complexity-tag" style={{ background: complex.color + '18', color: complex.color }}>{complex.label}</span>
          <span className="pillar-tag" style={{ color: pillar.color }}>{pillar.label}</span>
        </div>
      </div>

      <div className="agent-card-name">{agent.name}</div>
      <div className="agent-card-purpose">{agent.purpose}</div>

      {agent.fit_reason && <div className="agent-card-fit">{agent.fit_reason}</div>}
      {agent.deployment_note && <div className="agent-deployment-note">🏗️ {agent.deployment_note}</div>}
      {agent.compliance_notes && <div className="agent-compliance-note">🔒 {agent.compliance_notes}</div>}

      <div className="agent-card-footer">
        <div className="agent-card-tools">
          {(agent.tools_available || []).slice(0, 3).map((t, i) => <span key={i} className="tool-pill">{t}</span>)}
          {agent.azure_service && <span className="tool-pill tool-pill-azure">{agent.azure_service}</span>}
        </div>
        <button className="agent-design-btn" onClick={() => onDesign(agent)}>
          Design <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function AgentStudio() {
  const { client, setClient, refreshClient } = useClient()

  const autoFocus = Object.entries(client?.scores || {})
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)
    .map(([k]) => k)

  // ── Core UI state ─────────────────────────────────────────────────────
  const [stage,           setStage]           = useState('configure')
  const [vertical,        setVertical]        = useState(client?.industry || '')
  const [focusAreas,      setFocusAreas]      = useState(autoFocus)
  const [agents,          setAgents]          = useState([])
  const [discovering,     setDiscovering]     = useState(false)
  const [selectedAgent,   setSelectedAgent]   = useState(null)
  const [filterPillar,    setFilterPillar]    = useState('all')
  const [filterComplexity,setFilterComplexity]= useState('all')
  const [customInput,     setCustomInput]     = useState('')
  const [customOpen,      setCustomOpen]      = useState(false)

  // ── Infrastructure & deployment ───────────────────────────────────────
  const [deploymentModel,       setDeploymentModel]       = useState('cloud_native')
  const [tools,                 setTools]                 = useState([])         // cloud tools
  const [toolCategoryMap,       setToolCategoryMap]       = useState({})         // custom cloud: tool → catId
  const [onPremTools,           setOnPremTools]           = useState([])
  const [onPremToolCategoryMap, setOnPremToolCategoryMap] = useState({})
  const [legacySystems,         setLegacySystems]         = useState([])
  const [legacyCategoryMap,     setLegacyCategoryMap]     = useState({})
  const [complianceFrameworks,  setComplianceFrameworks]  = useState([])

  // ── Per-category "+ Add" input ────────────────────────────────────────
  const [addingCategory, setAddingCategory] = useState(null)   // { section, catId }
  const [addInputValue,  setAddInputValue]  = useState('')

  // ── Backlog ───────────────────────────────────────────────────────────
  const [backlog,        setBacklog]        = useState([])
  const [backlogLoading, setBacklogLoading] = useState(false)
  const [backlogSaved,   setBacklogSaved]   = useState(null)

  // ── Environment profile modal ─────────────────────────────────────────
  const [showEnvModal,    setShowEnvModal]    = useState(false)
  const [continueAnyway,  setContinueAnyway]  = useState(false)

  // ── Config persistence ────────────────────────────────────────────────
  const [configLoaded,   setConfigLoaded]   = useState(false)
  const [configExpanded, setConfigExpanded] = useState(true)
  const [showSaved,      setShowSaved]      = useState(false)
  const saveTimeoutRef = useRef(null)
  const savedToastRef  = useRef(null)

  // ── Load client data on mount / client change ─────────────────────────
  useEffect(() => {
    setConfigLoaded(false)
    const af = Object.entries(client?.scores || {})
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 2)
      .map(([k]) => k)

    if (!client?.id) {
      setFocusAreas(af); setBacklog([]); setConfigLoaded(true); return
    }

    setBacklogLoading(true)
    fetch(`${API}/api/clients/${client.id}`)
      .then(r => r.json())
      .then(data => {
        // Prefer environmentProfile as primary source; fall back to studioConfig
        const ep   = data.environmentProfile
        const saved = data.studioConfig

        const vertical_ = ep?.vertical || saved?.vertical
        if (vertical_)              setVertical(vertical_)
        else if (client?.industry)  setVertical(client.industry)

        const dm = ep?.deploymentModel || saved?.deploymentModel
        if (dm)  setDeploymentModel(dm)

        // cloudTools (env) ↔ tools (studio)
        if (ep?.cloudTools?.length)              setTools(ep.cloudTools)
        else if (saved?.tools?.length)           setTools(saved.tools)

        if (ep?.cloudToolCategoryMap)            setToolCategoryMap(ep.cloudToolCategoryMap)
        else if (saved?.toolCategoryMap)         setToolCategoryMap(saved.toolCategoryMap)

        if (ep?.onPremTools?.length)             setOnPremTools(ep.onPremTools)
        else if (saved?.onPremTools?.length)     setOnPremTools(saved.onPremTools)

        // onPremCategoryMap (env) ↔ onPremToolCategoryMap (studio)
        if (ep?.onPremCategoryMap)               setOnPremToolCategoryMap(ep.onPremCategoryMap)
        else if (saved?.onPremToolCategoryMap)   setOnPremToolCategoryMap(saved.onPremToolCategoryMap)

        if (ep?.legacySystems?.length)           setLegacySystems(ep.legacySystems)
        else if (saved?.legacySystems?.length)   setLegacySystems(saved.legacySystems)

        if (ep?.legacyCategoryMap)               setLegacyCategoryMap(ep.legacyCategoryMap)
        else if (saved?.legacyCategoryMap)       setLegacyCategoryMap(saved.legacyCategoryMap)

        if (ep?.complianceFrameworks?.length)              setComplianceFrameworks(ep.complianceFrameworks)
        else if (saved?.complianceFrameworks?.length)      setComplianceFrameworks(saved.complianceFrameworks)

        // focusAreas is studio-specific
        if (saved?.focusAreas?.length)           setFocusAreas(saved.focusAreas)
        else                                     setFocusAreas(af)

        const hasConfig = (ep?.cloudTools?.length || saved?.tools?.length || 0) > 0 ||
                          (ep?.onPremTools?.length || saved?.onPremTools?.length || 0) > 0
        if (hasConfig) setConfigExpanded(false)

        setBacklog(data.agentBacklog || [])
      })
      .catch(() => { if (client?.industry) setVertical(client.industry); setFocusAreas(af) })
      .finally(() => { setBacklogLoading(false); setConfigLoaded(true) })
  }, [client?.id])

  // ── Debounced auto-save ───────────────────────────────────────────────
  function saveConfig(v, dm, t, tcm, opt, optcm, ls, lcm, cf, fa) {
    if (!client?.id || !configLoaded) return
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Save environment fields to /environment endpoint (mapped field names)
        const envRes = await fetch(`${API}/api/clients/${client.id}/environment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vertical: v,
            deploymentModel: dm,
            cloudTools: t,
            cloudToolCategoryMap: tcm,
            onPremTools: opt,
            onPremCategoryMap: optcm,
            legacySystems: ls,
            legacyCategoryMap: lcm,
            complianceFrameworks: cf,
          }),
        })
        // Save focusAreas (studio-specific) to /studio-config
        const studioRes = await fetch(`${API}/api/clients/${client.id}/studio-config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focusAreas: fa }),
        })
        if (envRes.ok && studioRes.ok) {
          clearTimeout(savedToastRef.current)
          setShowSaved(true)
          savedToastRef.current = setTimeout(() => setShowSaved(false), 2000)
          refreshClient(client.id)
        }
      } catch (err) { console.error('Failed to save studio config:', err) }
    }, 800)
  }

  useEffect(() => {
    if (configLoaded)
      saveConfig(vertical, deploymentModel, tools, toolCategoryMap, onPremTools, onPremToolCategoryMap, legacySystems, legacyCategoryMap, complianceFrameworks, focusAreas)
  }, [vertical, deploymentModel, tools, toolCategoryMap, onPremTools, onPremToolCategoryMap, legacySystems, legacyCategoryMap, complianceFrameworks, focusAreas, configLoaded])

  // ── Cloud tool handlers ───────────────────────────────────────────────
  function toggleCloudTool(tool) {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }
  function addCustomCloudTool(catId, tool) {
    setTools(prev => prev.includes(tool) ? prev : [...prev, tool])
    setToolCategoryMap(prev => ({ ...prev, [tool]: catId }))
  }
  function removeCustomCloudTool(tool) {
    setTools(prev => prev.filter(t => t !== tool))
    setToolCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  // ── On-prem tool handlers ─────────────────────────────────────────────
  function toggleOnPremTool(tool) {
    setOnPremTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }
  function addCustomOnPremTool(catId, tool) {
    setOnPremTools(prev => prev.includes(tool) ? prev : [...prev, tool])
    setOnPremToolCategoryMap(prev => ({ ...prev, [tool]: catId }))
  }
  function removeCustomOnPremTool(tool) {
    setOnPremTools(prev => prev.filter(t => t !== tool))
    setOnPremToolCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  // ── Legacy system handlers ────────────────────────────────────────────
  function toggleLegacySystem(tool) {
    setLegacySystems(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }
  function addCustomLegacySystem(catId, tool) {
    setLegacySystems(prev => prev.includes(tool) ? prev : [...prev, tool])
    setLegacyCategoryMap(prev => ({ ...prev, [tool]: catId }))
  }
  function removeCustomLegacySystem(tool) {
    setLegacySystems(prev => prev.filter(t => t !== tool))
    setLegacyCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  function toggleCompliance(id) {
    setComplianceFrameworks(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  function toggleFocus(pillar) {
    setFocusAreas(prev => prev.includes(pillar) ? prev.filter(p => p !== pillar) : [...prev, pillar])
  }

  // ── Backlog handlers ──────────────────────────────────────────────────
  async function addToBacklog(agent) {
    if (!client?.id) return
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      })
      const updatedClient = await res.json()
      setBacklog(updatedClient.agentBacklog || [])
      refreshClient(client.id)
      setBacklogSaved(agent.id)
      setTimeout(() => setBacklogSaved(null), 2500)
    } catch (err) { console.error('Backlog save error:', err) }
  }

  async function updateAgentStatus(agentId, newStatus) {
    if (!client?.id) return
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setBacklog((await res.json()).agentBacklog || [])
    } catch (err) { console.error('Status update error:', err) }
  }

  async function removeFromBacklog(agentId) {
    if (!client?.id) return
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents/${agentId}`, { method: 'DELETE' })
      setBacklog((await res.json()).agentBacklog || [])
    } catch (err) { console.error('Remove error:', err) }
  }

  // ── Discover ──────────────────────────────────────────────────────────
  function buildCatSummary(selectedArr, catMap, categories) {
    const grouped = {}
    // Group predefined tools by their known category
    categories.forEach(cat => {
      const inCat = cat.tools.filter(t => selectedArr.includes(t))
      if (inCat.length) { grouped[cat.label] = inCat }
    })
    // Add custom tools by their catMap
    selectedArr.filter(t => catMap[t]).forEach(t => {
      const cat = categories.find(c => c.id === catMap[t])
      const label = cat?.label || 'Other'
      if (!grouped[label]) grouped[label] = []
      if (!grouped[label].includes(t)) grouped[label].push(t)
    })
    return Object.entries(grouped).map(([l, ts]) => `${l}: ${ts.join(', ')}`).join(' | ') || 'None'
  }

  async function discover(customDescription) {
    if (!vertical && !customDescription) return
    setDiscovering(true)
    if (stage !== 'discover') setStage('discover')
    try {
      const res = await fetch(`${API}/api/agents/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical,
          deploymentModel,
          toolsByCat:       buildCatSummary(tools, toolCategoryMap, CLOUD_TOOL_CATEGORIES),
          onPremToolsByCat: buildCatSummary(onPremTools, onPremToolCategoryMap, ON_PREM_CATEGORIES),
          legacySystems:    legacySystems.join(', '),
          complianceFrameworks: complianceFrameworks.join(', '),
          constraints:      (client?.environmentProfile?.constraints || []).join(', '),
          tools:            [...tools, ...onPremTools],
          focusAreas,
          clientScores:     client?.scores,
          clientName:       client?.name,
          customDescription,
        }),
      })
      const data = await res.json()
      const incoming = data.agents || []
      console.log('Agents received:', incoming.length, incoming.map(a => a.complexity))
      if (customDescription && incoming.length) setAgents(prev => [...prev, ...incoming])
      else setAgents(incoming)
    } catch (err) { console.error('Discover error:', err) }
    finally { setDiscovering(false) }
  }

  async function addCustomAgent() {
    if (!customInput.trim()) return
    setCustomOpen(false)
    const desc = customInput.trim(); setCustomInput('')
    const customAgent = {
      id: 'custom-' + Date.now(),
      name: desc.length > 60 ? desc.slice(0, 57) + '…' : desc,
      purpose: desc, pillar: 'strategy',
      tools_required: tools, tools_available: tools, complexity: 'strategic',
      fit_score: 0, fit_reason: 'Custom agent specified by advisor',
      estimated_effort: 'TBD', estimated_value: 'TBD', azure_service: 'Azure AI Foundry',
    }
    setSelectedAgent(customAgent)
  }

  const filteredAgents = agents
    .filter(a => {
      const pillarMatch     = filterPillar === 'all'     || !filterPillar     || a.pillar === filterPillar
      const complexityMatch = filterComplexity === 'all' || !filterComplexity || a.complexity === filterComplexity
      return pillarMatch && complexityMatch
    })
    .sort((a, b) => b.fit_score - a.fit_score)

  const groups = [
    { key: 'quick_win', label: 'Quick Wins',            agents: filteredAgents.filter(a => a.complexity === 'quick_win') },
    { key: 'strategic', label: 'Strategic Initiatives', agents: filteredAgents.filter(a => a.complexity === 'strategic') },
    { key: 'complex',   label: 'Complex Builds',        agents: filteredAgents.filter(a => a.complexity === 'complex') },
  ].filter(g => g.agents.length > 0)

  const clientName        = client?.name || 'this client'
  const hasExistingConfig = tools.length > 0 || onPremTools.length > 0 || legacySystems.length > 0
  const showOnPrem        = ['hybrid', 'on_prem', 'air_gapped'].includes(deploymentModel)
  const currentDeploy     = DEPLOYMENT_MODELS.find(d => d.id === deploymentModel)
  const profileStaleness  = useMemo(
    () => getStalenessStatus(client, null).results.overallProfile,
    [client?.environmentProfile?.updatedAt]
  )

  // Sort compliance chips: vertical-relevant ones first
  const sortedCompliance = [...COMPLIANCE_FRAMEWORKS].sort((a, b) => {
    const aRel = a.verticals.includes(vertical) ? 1 : 0
    const bRel = b.verticals.includes(vertical) ? 1 : 0
    return bRel - aRel
  })

  /* ── Configure stage ──────────────────────────────────────────────── */
  function handleEnvComplete(updated) {
    setClient(updated)
    setShowEnvModal(false)
    // Sync environment profile into studio config state
    const ep = updated.environmentProfile
    if (ep) {
      if (ep.vertical)             setVertical(ep.vertical)
      if (ep.deploymentModel)      setDeploymentModel(ep.deploymentModel)
      if (ep.cloudTools?.length)   setTools(ep.cloudTools)
      if (ep.cloudToolCategoryMap) setToolCategoryMap(ep.cloudToolCategoryMap)
      if (ep.onPremTools?.length)  setOnPremTools(ep.onPremTools)
      if (ep.onPremCategoryMap)    setOnPremToolCategoryMap(ep.onPremCategoryMap)
      if (ep.legacySystems?.length) setLegacySystems(ep.legacySystems)
      if (ep.legacyCategoryMap)    setLegacyCategoryMap(ep.legacyCategoryMap)
      if (ep.complianceFrameworks?.length) setComplianceFrameworks(ep.complianceFrameworks)
    }
  }

  if (stage === 'configure') {
    const hasProfile = !!client?.environmentProfile
    return (
      <>
        {showEnvModal && client && (
          <EnvironmentProfile
            client={client}
            onComplete={handleEnvComplete}
            onSkip={() => setShowEnvModal(false)}
          />
        )}
      <div className="studio-configure">
        <div className="studio-configure-card">
          <div className="studio-header">
            <Zap size={20} className="studio-icon" />
            <div>
              <h1 className="studio-title">Agent Design Studio</h1>
              <p className="studio-sub">Design AI agents tailored to {clientName}</p>
            </div>
          </div>

          {/* Environment profile banner */}
          {hasProfile ? (
            <div className="env-banner complete">
              <div className="env-banner-left">
                <span>✓</span>
                <div className="env-banner-text">
                  <div className="env-banner-main">Environment profile complete</div>
                  <div className="env-banner-sub">
                    {client.environmentProfile.vertical} · {DEPLOYMENT_MODELS.find(d => d.id === client.environmentProfile.deploymentModel)?.label} · {(client.environmentProfile.cloudTools?.length || 0) + (client.environmentProfile.onPremTools?.length || 0)} tools
                    {client.environmentProfile.complianceFrameworks?.length > 0 && ` · ${client.environmentProfile.complianceFrameworks.join(', ')}`}
                  </div>
                </div>
              </div>
              <button className="env-banner-btn" onClick={() => setShowEnvModal(true)}>Edit Profile</button>
            </div>
          ) : (
            <div className="env-banner missing">
              <div className="env-banner-left">
                <span>⚠</span>
                <div className="env-banner-text">
                  <div className="env-banner-main">Environment profile not set up</div>
                  <div className="env-banner-sub">Set deployment model, tools, and compliance to get infrastructure-aware agent recommendations.</div>
                </div>
              </div>
              <button className="env-banner-btn" onClick={() => setShowEnvModal(true)}>Set Up Profile</button>
            </div>
          )}

          {/* Compact summary bar */}
          {!configExpanded ? (
            <div className="config-summary">
              <div className="config-summary-left">
                {vertical && <span className="config-vertical-badge">{vertical}</span>}
                <span className="deployment-badge">{currentDeploy?.icon} {currentDeploy?.label}</span>
                <span className="config-tool-count">{tools.length + onPremTools.length} tool{tools.length + onPremTools.length !== 1 ? 's' : ''}</span>
                {legacySystems.length > 0 && <span className="config-tool-count">{legacySystems.length} legacy system{legacySystems.length !== 1 ? 's' : ''}</span>}
                {complianceFrameworks.length > 0 && <span className="compliance-badge">{complianceFrameworks.join(', ')}</span>}
              </div>
              <button className="config-edit-btn" onClick={() => setConfigExpanded(true)}>Edit configuration ✎</button>
            </div>
          ) : (
            <>
              {/* Section 1 — Industry Vertical */}
              <div className="config-field">
                <label className="config-label">Industry Vertical</label>
                <select className="config-select" value={vertical} onChange={e => setVertical(e.target.value)}>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              {/* Section 2 — Infrastructure & Deployment Model */}
              <div className="config-field">
                <label className="config-label">Infrastructure & Deployment Model</label>
                <div className="deployment-grid">
                  {DEPLOYMENT_MODELS.map(model => (
                    <button
                      key={model.id}
                      className={`deployment-card${deploymentModel === model.id ? ' selected' : ''}`}
                      onClick={() => setDeploymentModel(model.id)}
                    >
                      <div className="dc-icon">{model.icon}</div>
                      <div className="dc-label">{model.label}</div>
                      <div className="dc-desc">{model.desc}</div>
                    </button>
                  ))}
                </div>

                {deploymentModel === 'air_gapped' && (
                  <div className="airgap-warning">
                    ⚠️ Air-gapped environment detected. Agent recommendations will be limited to fully on-premises architectures with no cloud API dependencies. Local model inference will be required.
                  </div>
                )}

                {/* On-prem infrastructure */}
                {showOnPrem && (
                  <div className="on-prem-section">
                    <div className="on-prem-header">
                      🏢 On-Premises Infrastructure
                    </div>
                    <div className="tool-categories">
                      {ON_PREM_CATEGORIES.map(cat => (
                        <ToolCategoryRow
                          key={cat.id}
                          cat={cat}
                          selected={onPremTools}
                          catMap={onPremToolCategoryMap}
                          addingCategory={addingCategory}
                          addInputValue={addInputValue}
                          setAddInputValue={setAddInputValue}
                          onToggle={toggleOnPremTool}
                          onAddCustom={addCustomOnPremTool}
                          onRemoveCustom={removeCustomOnPremTool}
                          onStartAdding={setAddingCategory}
                          sectionKey="onprem"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy systems */}
                <div className="legacy-section">
                  <div className="legacy-note">
                    ⚠️ Legacy &amp; Custom Systems
                    <span style={{ fontWeight: 400, color: 'var(--z-muted)', marginLeft: 6 }}>
                      — often the highest-value agent integration targets
                    </span>
                  </div>
                  <div className="tool-categories">
                    {LEGACY_CATEGORIES.map(cat => (
                      <ToolCategoryRow
                        key={cat.id}
                        cat={cat}
                        selected={legacySystems}
                        catMap={legacyCategoryMap}
                        addingCategory={addingCategory}
                        addInputValue={addInputValue}
                        setAddInputValue={setAddInputValue}
                        onToggle={toggleLegacySystem}
                        onAddCustom={addCustomLegacySystem}
                        onRemoveCustom={removeCustomLegacySystem}
                        onStartAdding={setAddingCategory}
                        sectionKey="legacy"
                      />
                    ))}
                  </div>
                </div>

                {/* Compliance */}
                <div className="compliance-section">
                  <label className="config-label">Compliance &amp; Data Residency</label>
                  <div className="compliance-chips">
                    {sortedCompliance.map(fw => {
                      const isRelevant = fw.verticals.includes(vertical)
                      const isSelected = complianceFrameworks.includes(fw.id)
                      return (
                        <button
                          key={fw.id}
                          className={`compliance-chip${isSelected ? ' selected' : ''}${isRelevant ? ' priority' : ''}`}
                          onClick={() => toggleCompliance(fw.id)}
                          title={fw.desc}
                        >
                          <span className="cc-label">{fw.label}</span>
                          <span className="cc-desc">{fw.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                  {complianceFrameworks.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--z-muted)', marginTop: 8, lineHeight: 1.5 }}>
                      Selected compliance frameworks constrain agent architecture — air-gapped or on-prem processing may be required.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3 — Cloud Tooling Stack */}
              <div className="config-field">
                <label className="config-label">Cloud Tooling Stack</label>
                <div className="tool-categories">
                  {CLOUD_TOOL_CATEGORIES
                    .filter(cat => !cat.verticals || cat.verticals.includes(vertical) || !vertical)
                    .map(cat => (
                      <ToolCategoryRow
                        key={cat.id}
                        cat={cat}
                        selected={tools}
                        catMap={toolCategoryMap}
                        addingCategory={addingCategory}
                        addInputValue={addInputValue}
                        setAddInputValue={setAddInputValue}
                        onToggle={toggleCloudTool}
                        onAddCustom={addCustomCloudTool}
                        onRemoveCustom={removeCustomCloudTool}
                        onStartAdding={setAddingCategory}
                        sectionKey="cloud"
                      />
                    ))}
                </div>
              </div>

              {/* Section 4 — Focus Areas */}
              <div className="config-field">
                <label className="config-label">
                  Focus Areas
                  {autoFocus.length > 0 && <span className="config-label-hint">auto-selected from lowest scores</span>}
                </label>
                <div className="focus-list">
                  {Object.entries(PILLAR_META).map(([key, meta]) => {
                    const score   = client?.scores?.[key]
                    const checked = focusAreas.includes(key)
                    const gap     = score !== null && score !== undefined && score < 2.5 ? 'critical gap' : score < 3.5 ? 'moderate gap' : null
                    return (
                      <label key={key} className={`focus-item${checked ? ' checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFocus(key)} />
                        <span className="focus-dot" style={{ background: meta.color }} />
                        <span className="focus-label">{meta.label}</span>
                        {score !== null && score !== undefined && (
                          <span className="focus-score">
                            {score.toFixed(1)}/5
                            {gap && <span className="focus-gap" style={{ color: gap === 'critical gap' ? '#E05A4E' : '#E8A838' }}> — {gap}</span>}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {hasExistingConfig && (
                <button className="config-collapse-btn" onClick={() => setConfigExpanded(false)}>↑ Collapse configuration</button>
              )}
            </>
          )}

          {profileStaleness.isStale && !continueAnyway && (
            <div className="studio-staleness-warning">
              <span>⏱️</span>
              <span>Environment profile is {profileStaleness.daysSince} days old — recommendations may not reflect current infrastructure.</span>
              <button onClick={() => setShowEnvModal(true)}>Update profile</button>
              <button onClick={() => setContinueAnyway(true)}>Continue anyway</button>
            </div>
          )}

          <button className="studio-generate-btn" onClick={() => discover()} disabled={!vertical || discovering}>
            {discovering ? <><Loader size={15} className="ap-spin" /> Analyzing…</> : <><Zap size={15} /> Generate Agent Recommendations</>}
          </button>
        </div>

        {showSaved && <div className="studio-saved-toast">✓ Configuration saved</div>}
      </div>
      </>
    )
  }

  /* ── Discover stage ───────────────────────────────────────────────── */
  return (
    <div className="studio-layout">
      <div className="studio-main">
        <div className="studio-topbar">
          <div className="studio-topbar-left">
            <Zap size={16} className="studio-icon" />
            <span className="studio-topbar-title">Agent Recommendations</span>
            <span className="studio-topbar-client">{clientName}</span>
            {currentDeploy && (
              <span className="studio-topbar-client">{currentDeploy.icon} {currentDeploy.label}</span>
            )}
          </div>
          <div className="studio-topbar-right">
            <button className="studio-back-btn" onClick={() => setStage('configure')}>← Reconfigure</button>
          </div>
        </div>

        <div className="studio-filters">
          <select className="filter-select" value={filterPillar} onChange={e => setFilterPillar(e.target.value)}>
            <option value="all">All pillars</option>
            {Object.entries(PILLAR_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select className="filter-select" value={filterComplexity} onChange={e => setFilterComplexity(e.target.value)}>
            <option value="all">All complexity</option>
            {Object.entries(COMPLEXITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <button className="custom-agent-btn" onClick={() => setCustomOpen(o => !o)}>
            <Plus size={13} /> Custom Agent
          </button>
        </div>

        {customOpen && (
          <div className="custom-agent-input-row">
            <input
              className="custom-agent-input"
              placeholder="Describe an agent you have in mind… (press Enter to design)"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomAgent()}
              autoFocus
            />
            <button className="studio-generate-btn" style={{ padding: '8px 16px', fontSize: 12 }} onClick={addCustomAgent}>
              Design →
            </button>
          </div>
        )}

        {discovering && agents.length === 0 ? (
          <div className="studio-loading">
            <Loader size={26} className="ap-spin" style={{ color: 'var(--z-blue-bright)' }} />
            <div className="studio-loading-text">Analyzing {clientName}'s stack and gaps…</div>
            <div className="studio-loading-sub">Identifying highest-value agent opportunities for {vertical}</div>
          </div>
        ) : agents.length === 0 ? (
          <div className="agents-empty">
            <div className="ae-icon">⚡</div>
            <div className="ae-title">No recommendations generated yet</div>
            <div className="ae-desc">Click "Generate Agent Recommendations" to analyse this client's profile and generate tailored agent blueprints.</div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="agents-empty">
            <div className="ae-title">No agents match the current filters</div>
            <div className="ae-desc">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} available — try clearing the filters.
              <button className="ae-clear-btn" onClick={() => { setFilterPillar('all'); setFilterComplexity('all') }}>Clear filters</button>
            </div>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.key} className="section-group">
              <div className="section-group-header">
                <span className="section-group-label" style={{ color: COMPLEXITY_META[group.key]?.color }}>{group.label}</span>
                <span className="section-group-count">{group.agents.length}</span>
              </div>
              <div className="agent-grid">
                {group.agents.map(agent => <AgentCard key={agent.id} agent={agent} onDesign={setSelectedAgent} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Backlog sidebar */}
      <div className="studio-sidebar">
        <div className="sidebar-heading">
          Agent Backlog
          {backlog.length > 0 && <span className="backlog-count-badge">{backlog.length}</span>}
        </div>
        {backlogSaved && <div className="backlog-saved-flash">✓ Saved to backlog</div>}
        {backlogLoading ? (
          <div className="sidebar-empty">Loading…</div>
        ) : backlog.length === 0 ? (
          <div className="sidebar-empty">
            <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
            No agents yet. Generate recommendations, click "Design →", then "Add to Agent Backlog".
          </div>
        ) : (
          <div className="backlog-list">
            {backlog.map(entry => {
              const sm = STATUS_META[entry.status] || STATUS_META.backlog
              return (
                <div key={entry.id || entry.name} className="backlog-item">
                  <div className="backlog-item-top">
                    <div className="backlog-item-name" onClick={() => setSelectedAgent(entry)} style={{ cursor: 'pointer', flex: 1 }}>
                      {entry.name}
                    </div>
                    <button className="backlog-remove-btn" onClick={() => removeFromBacklog(entry.id)} title="Remove">✕</button>
                  </div>
                  {entry.fit_score > 0 && <div className="backlog-fit" style={{ color: fitColor(entry.fit_score) }}>{entry.fit_score}% fit</div>}
                  <select
                    className="backlog-status-select"
                    value={entry.status || 'backlog'}
                    onChange={e => updateAgentStatus(entry.id, e.target.value)}
                    style={{ borderColor: sm.color + '55', color: sm.color }}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="deployed">Deployed</option>
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedAgent && (
        <AgentDesignPanel
          agent={selectedAgent}
          client={client}
          vertical={vertical}
          tools={[...tools, ...onPremTools]}
          onClose={() => setSelectedAgent(null)}
          onAddToBacklog={addToBacklog}
        />
      )}

      {showSaved && <div className="studio-saved-toast">✓ Configuration saved</div>}
    </div>
  )
}
