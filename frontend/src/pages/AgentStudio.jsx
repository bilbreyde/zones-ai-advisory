import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Zap, X, Loader, Download, Plus, ChevronRight } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ChatVisual from '../components/ChatVisual.jsx'
import './AgentStudio.css'

const API = import.meta.env.VITE_API_URL || ''

const INDUSTRIES = [
  'Financial Services', 'Healthcare', 'Manufacturing', 'Retail',
  'Energy', 'Professional Services', 'Public Sector', 'Technology',
]

const TOOL_CATEGORIES = [
  { label: 'CRM',   tools: ['Salesforce', 'HubSpot', 'Dynamics 365'] },
  { label: 'ERP',   tools: ['SAP', 'Oracle', 'NetSuite'] },
  { label: 'Cloud', tools: ['Azure', 'AWS', 'GCP', 'Multi-cloud'] },
  { label: 'Data',  tools: ['Databricks', 'Snowflake', 'Microsoft Fabric'] },
  { label: 'ITSM',  tools: ['ServiceNow', 'Jira', 'Zendesk'] },
  { label: 'Collab',tools: ['Teams', 'Slack', 'SharePoint'] },
]

const PILLAR_META = {
  governance: { label: 'Governance',       color: '#4A9FE0' },
  risk:       { label: 'Risk & Compliance', color: '#E8A838' },
  strategy:   { label: 'AI Strategy',      color: '#8B5CF6' },
  operations: { label: 'Operations',       color: '#3DBA7E' },
  enablement: { label: 'Enablement',       color: '#EC4899' },
}

const COMPLEXITY_META = {
  quick_win:  { label: 'Quick Win',  color: '#3DBA7E' },
  strategic:  { label: 'Strategic',  color: '#4A9FE0' },
  complex:    { label: 'Complex',    color: '#8B5CF6' },
}

const STATUS_META = {
  backlog:     { label: 'Backlog',      color: '#4A9FE0' },
  in_progress: { label: 'In Progress',  color: '#E8A838' },
  deployed:    { label: 'Deployed',     color: '#3DBA7E' },
}

const fitColor = s => s >= 80 ? '#3DBA7E' : s >= 60 ? '#4A9FE0' : s >= 40 ? '#E8A838' : 'var(--z-muted)'

/* ── Agent Design Panel (slide-over) ──────────────────────────────────── */
function AgentDesignPanel({ agent, client, vertical, tools, onClose, onAddToBacklog }) {
  const [isOpen,          setIsOpen]          = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [reply,           setReply]           = useState('')
  const [visuals,         setVisuals]         = useState([])
  const [pdfLoading,      setPdfLoading]      = useState(false)
  const [addedToBacklog,  setAddedToBacklog]  = useState(false)
  const [fetchKey,        setFetchKey]        = useState(0)
  const panelRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setIsOpen(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setLoading(true)
    setReply('')
    setVisuals([])
    fetch(`${API}/api/agents/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        clientName:   client?.name,
        clientScores: client?.scores,
        vertical,
        tools,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setReply(data.reply || '')
        const v = data.visuals?.length ? data.visuals : data.visual ? [data.visual] : []
        setVisuals(v)
      })
      .catch(() => setReply('Failed to generate blueprint. Please try again.'))
      .finally(() => setLoading(false))
  }, [fetchKey])

  function handleClose() {
    setIsOpen(false)
    setTimeout(onClose, 300)
  }

  async function handleAddToBacklog() {
    if (addedToBacklog) return
    setAddedToBacklog(true)
    await onAddToBacklog?.(agent)
  }

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const PAGE_W = 210, PAGE_H = 297, MARGIN = 14
      const CONTENT_W = PAGE_W - MARGIN * 2
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      pdf.setFillColor(10, 22, 40)
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
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
        pdf.line(MARGIN, 10, PAGE_W - MARGIN, 10)
        yPos = 16
      }

      async function addElement(el) {
        if (!el) return
        el.scrollIntoView({ block: 'nearest' })
        await new Promise(r => setTimeout(r, 120))
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#0F2040', logging: false })
        const imgData = canvas.toDataURL('image/png')
        const rawH    = (canvas.height / canvas.width) * CONTENT_W
        const maxH    = PAGE_H - MARGIN * 2 - 6
        const imgH    = Math.min(rawH, maxH)
        const imgW    = rawH > maxH ? CONTENT_W * (maxH / rawH) : CONTENT_W
        if (yPos + imgH > PAGE_H - MARGIN) {
          pdf.addPage(); pdf.setFillColor(10, 22, 40); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
          addPageHeader()
        }
        pdf.addImage(imgData, 'PNG', MARGIN, yPos, imgW, imgH)
        yPos += imgH + 5
      }

      pdf.addPage(); pdf.setFillColor(10, 22, 40); pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
      addPageHeader()

      const container = panelRef.current
      if (container) {
        const summaryEl = container.querySelector('.plan-summary')
        if (summaryEl) await addElement(summaryEl)
        const sections = container.querySelectorAll('.action-plan-section')
        for (const section of sections) {
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
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setPdfLoading(false)
    }
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

              {reply && (
                <div className="plan-summary">
                  <div className="plan-summary-icon">⚡</div>
                  <p>{reply}</p>
                </div>
              )}

              {visuals.map((visual, i) => (
                <div key={i} className="action-plan-section">
                  {i > 0 && (
                    <div className="section-divider">
                      <span className="section-num">0{i + 1}</span>
                      <div className="divider-line" />
                    </div>
                  )}
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
                  <div className="chat-visual-wrapper">
                    <ChatVisual visual={visual} />
                  </div>
                </div>
              ))}

              {!reply && visuals.length === 0 && (
                <div className="blueprint-error">
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontSize: 13, color: 'var(--z-white)', marginBottom: 4, fontWeight: 500 }}>
                    Blueprint generation failed
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--z-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                    The AI response could not be parsed into structured visuals. This can happen when the response is truncated.
                  </div>
                  <button
                    className="studio-generate-btn"
                    style={{ width: 'auto', padding: '8px 20px' }}
                    onClick={() => setFetchKey(k => k + 1)}
                  >
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
  const pillar  = PILLAR_META[agent.pillar]   || { label: agent.pillar,   color: '#4A9FE0' }
  const complex = COMPLEXITY_META[agent.complexity] || { label: agent.complexity, color: '#4A9FE0' }
  const color   = fitColor(agent.fit_score)

  return (
    <div className="agent-card">
      <div className="agent-card-top">
        <div className="fit-badge" style={{ background: color + '22', color, borderColor: color + '44' }}>
          {agent.fit_score}
        </div>
        <div className="agent-card-meta">
          <span className="complexity-tag" style={{ background: complex.color + '18', color: complex.color }}>
            {complex.label}
          </span>
          <span className="pillar-tag" style={{ color: pillar.color }}>{pillar.label}</span>
        </div>
      </div>

      <div className="agent-card-name">{agent.name}</div>
      <div className="agent-card-purpose">{agent.purpose}</div>

      {agent.fit_reason && (
        <div className="agent-card-fit">{agent.fit_reason}</div>
      )}

      <div className="agent-card-footer">
        <div className="agent-card-tools">
          {(agent.tools_available || []).slice(0, 3).map((t, i) => (
            <span key={i} className="tool-pill">{t}</span>
          ))}
          {agent.azure_service && (
            <span className="tool-pill tool-pill-azure">{agent.azure_service}</span>
          )}
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
  const { client, refreshClient } = useClient()

  // Derive auto-selected focus areas from lowest pillar scores
  const autoFocus = Object.entries(client?.scores || {})
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)
    .map(([k]) => k)

  const [stage,         setStage]         = useState('configure')
  const [vertical,      setVertical]      = useState(client?.industry || '')
  const [tools,         setTools]         = useState([])
  const [customTool,    setCustomTool]    = useState('')
  const [focusAreas,    setFocusAreas]    = useState(autoFocus)
  const [agents,        setAgents]        = useState([])
  const [discovering,   setDiscovering]   = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [backlog,       setBacklog]       = useState([])
  const [backlogLoading, setBacklogLoading] = useState(false)
  const [backlogSaved,  setBacklogSaved]  = useState(null)
  const [filter,        setFilter]        = useState({ pillar: '', complexity: '' })
  const [customInput,   setCustomInput]   = useState('')
  const [customOpen,    setCustomOpen]    = useState(false)
  const [configLoaded,  setConfigLoaded]  = useState(false)
  const [configExpanded, setConfigExpanded] = useState(true)
  const [showSaved,     setShowSaved]     = useState(false)
  const saveTimeoutRef = useRef(null)
  const savedToastRef  = useRef(null)

  // Load client data on mount / client change:
  //   - restore saved studioConfig (vertical, tools, focusAreas)
  //   - collapse the config form if a config already exists
  //   - load backlog fresh (never trust the stale context snapshot)
  useEffect(() => {
    setConfigLoaded(false)

    // Derive default focus areas from lowest pillar scores
    const af = Object.entries(client?.scores || {})
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 2)
      .map(([k]) => k)

    if (!client?.id) {
      setFocusAreas(af)
      setBacklog([])
      setConfigLoaded(true)
      return
    }

    setBacklogLoading(true)
    fetch(`${API}/api/clients/${client.id}`)
      .then(r => r.json())
      .then(data => {
        const saved = data.studioConfig

        if (saved?.vertical)         setVertical(saved.vertical)
        else if (client?.industry)   setVertical(client.industry)

        if (saved?.tools?.length)    setTools(saved.tools)
        if (saved?.focusAreas?.length) setFocusAreas(saved.focusAreas)
        else                         setFocusAreas(af)

        // Collapse config form if they already have a saved stack
        if (saved?.tools?.length > 0) setConfigExpanded(false)

        setBacklog(data.agentBacklog || [])
      })
      .catch(() => {
        if (client?.industry) setVertical(client.industry)
        setFocusAreas(af)
      })
      .finally(() => {
        setBacklogLoading(false)
        setConfigLoaded(true)
      })
  }, [client?.id])

  async function addToBacklog(agent) {
    if (!client?.id) return
    console.log('Saving agent to backlog:', agent)
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      })
      const updatedClient = await res.json()
      console.log('POST response agentBacklog length:', updatedClient.agentBacklog?.length)
      setBacklog(updatedClient.agentBacklog || [])
      // Also update context + localStorage so other pages see fresh data
      refreshClient(client.id)
      setBacklogSaved(agent.id)
      setTimeout(() => setBacklogSaved(null), 2500)
    } catch (err) {
      console.error('Backlog save error:', err)
    }
  }

  async function updateAgentStatus(agentId, newStatus) {
    if (!client?.id) return
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const updatedClient = await res.json()
      setBacklog(updatedClient.agentBacklog || [])
    } catch (err) {
      console.error('Status update error:', err)
    }
  }

  async function removeFromBacklog(agentId) {
    if (!client?.id) return
    try {
      const res = await fetch(`${API}/api/clients/${client.id}/agents/${agentId}`, {
        method: 'DELETE',
      })
      const updatedClient = await res.json()
      setBacklog(updatedClient.agentBacklog || [])
    } catch (err) {
      console.error('Remove error:', err)
    }
  }

  // Debounced auto-save of studio config to Cosmos DB
  function saveConfig(v, t, fa) {
    if (!client?.id || !configLoaded) return
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/clients/${client.id}/studio-config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vertical: v, tools: t, focusAreas: fa }),
        })
        if (res.ok) {
          clearTimeout(savedToastRef.current)
          setShowSaved(true)
          savedToastRef.current = setTimeout(() => setShowSaved(false), 2000)
          refreshClient(client.id)
        }
      } catch (err) {
        console.error('Failed to save studio config:', err)
      }
    }, 800)
  }

  // Trigger save whenever config fields change (only after initial load)
  useEffect(() => {
    if (configLoaded) saveConfig(vertical, tools, focusAreas)
  }, [vertical, tools, focusAreas, configLoaded])

  function toggleTool(tool) {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }

  function toggleFocus(pillar) {
    setFocusAreas(prev => prev.includes(pillar) ? prev.filter(p => p !== pillar) : [...prev, pillar])
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
          tools,
          focusAreas,
          clientScores: client?.scores,
          clientName:   client?.name,
          customDescription,
        }),
      })
      const data = await res.json()
      if (customDescription && data.agents?.length) {
        // Append custom agent to existing list
        setAgents(prev => [...prev, ...data.agents])
      } else {
        setAgents(data.agents || [])
      }
    } catch (err) {
      console.error('Discover error:', err)
    } finally {
      setDiscovering(false)
    }
  }

  async function addCustomAgent() {
    if (!customInput.trim()) return
    setCustomOpen(false)
    const desc = customInput.trim()
    setCustomInput('')
    // Create a minimal agent object and open design panel directly
    const customAgent = {
      id:          'custom-' + Date.now(),
      name:        desc.length > 60 ? desc.slice(0, 57) + '…' : desc,
      purpose:     desc,
      pillar:      'strategy',
      tools_required:  tools,
      tools_available: tools,
      complexity:  'strategic',
      fit_score:   0,
      fit_reason:  'Custom agent specified by advisor',
      estimated_effort: 'TBD',
      estimated_value:  'TBD',
      azure_service:    'Azure AI Foundry',
    }
    setSelectedAgent(customAgent)
  }

  // Filtered + grouped agents
  const filtered = agents.filter(a =>
    (!filter.pillar     || a.pillar      === filter.pillar) &&
    (!filter.complexity || a.complexity  === filter.complexity)
  ).sort((a, b) => b.fit_score - a.fit_score)

  const groups = [
    { key: 'quick_win',  label: 'Quick Wins',           agents: filtered.filter(a => a.complexity === 'quick_win') },
    { key: 'strategic',  label: 'Strategic Initiatives', agents: filtered.filter(a => a.complexity === 'strategic') },
    { key: 'complex',    label: 'Complex Builds',        agents: filtered.filter(a => a.complexity === 'complex') },
  ].filter(g => g.agents.length > 0)

  const clientName = client?.name || 'this client'

  const hasExistingConfig = tools.length > 0

  /* ── Configure ──────────────────────────────────────────────────────── */
  if (stage === 'configure') {
    return (
      <div className="studio-configure">
        <div className="studio-configure-card">
          <div className="studio-header">
            <Zap size={20} className="studio-icon" />
            <div>
              <h1 className="studio-title">Agent Design Studio</h1>
              <p className="studio-sub">Design AI agents tailored to {clientName}</p>
            </div>
          </div>

          {/* Compact summary bar shown when config is saved and collapsed */}
          {!configExpanded ? (
            <div className="config-summary">
              <div className="config-summary-left">
                {vertical && <span className="config-vertical-badge">{vertical}</span>}
                <span className="config-tool-count">
                  {tools.length} tool{tools.length !== 1 ? 's' : ''} configured
                </span>
                {focusAreas.length > 0 && (
                  <span className="config-focus-count">
                    {focusAreas.length} focus area{focusAreas.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button className="config-edit-btn" onClick={() => setConfigExpanded(true)}>
                Edit configuration ✎
              </button>
            </div>
          ) : (
            <>
              <div className="config-field">
                <label className="config-label">Industry Vertical</label>
                <select
                  className="config-select"
                  value={vertical}
                  onChange={e => setVertical(e.target.value)}
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="config-field">
                <label className="config-label">Current Tooling Stack</label>
                <div className="tool-categories">
                  {TOOL_CATEGORIES.map(cat => (
                    <div key={cat.label} className="tool-category">
                      <div className="tool-category-label">{cat.label}</div>
                      <div className="tool-chips">
                        {cat.tools.map(tool => (
                          <button
                            key={tool}
                            className={`tool-chip${tools.includes(tool) ? ' selected' : ''}`}
                            onClick={() => toggleTool(tool)}
                          >
                            {tool}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="tool-category">
                    <div className="tool-category-label">Other</div>
                    <div className="tool-chips">
                      <input
                        className="tool-custom-input"
                        placeholder="Type tool name + Enter"
                        value={customTool}
                        onChange={e => setCustomTool(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customTool.trim()) {
                            toggleTool(customTool.trim())
                            setCustomTool('')
                          }
                        }}
                      />
                      {tools.filter(t => !TOOL_CATEGORIES.flatMap(c => c.tools).includes(t)).map(t => (
                        <button key={t} className="tool-chip selected" onClick={() => toggleTool(t)}>{t} ×</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

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
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFocus(key)}
                        />
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
                <button className="config-collapse-btn" onClick={() => setConfigExpanded(false)}>
                  ↑ Collapse configuration
                </button>
              )}
            </>
          )}

          <button
            className="studio-generate-btn"
            onClick={() => discover()}
            disabled={!vertical || discovering}
          >
            {discovering
              ? <><Loader size={15} className="ap-spin" /> Analyzing…</>
              : <><Zap size={15} /> Generate Agent Recommendations</>}
          </button>
        </div>

        {showSaved && <div className="studio-saved-toast">✓ Configuration saved</div>}
      </div>
    )
  }

  /* ── Discover ───────────────────────────────────────────────────────── */
  return (
    <div className="studio-layout">
      <div className="studio-main">
        {/* Top bar */}
        <div className="studio-topbar">
          <div className="studio-topbar-left">
            <Zap size={16} className="studio-icon" />
            <span className="studio-topbar-title">Agent Recommendations</span>
            <span className="studio-topbar-client">{clientName}</span>
          </div>
          <div className="studio-topbar-right">
            <button className="studio-back-btn" onClick={() => setStage('configure')}>
              ← Reconfigure
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="studio-filters">
          <select className="filter-select" value={filter.pillar} onChange={e => setFilter(f => ({ ...f, pillar: e.target.value }))}>
            <option value="">All pillars</option>
            {Object.entries(PILLAR_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select className="filter-select" value={filter.complexity} onChange={e => setFilter(f => ({ ...f, complexity: e.target.value }))}>
            <option value="">All complexity</option>
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

        {/* Loading skeleton */}
        {discovering && agents.length === 0 ? (
          <div className="studio-loading">
            <Loader size={26} className="ap-spin" style={{ color: 'var(--z-blue-bright)' }} />
            <div className="studio-loading-text">Analyzing {clientName}'s stack and gaps…</div>
            <div className="studio-loading-sub">Identifying highest-value agent opportunities for {vertical}</div>
          </div>
        ) : groups.length === 0 ? (
          <div className="studio-loading">
            <div className="studio-loading-text">No agents match the current filters.</div>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.key} className="section-group">
              <div className="section-group-header">
                <span className="section-group-label" style={{ color: COMPLEXITY_META[group.key]?.color }}>
                  {group.label}
                </span>
                <span className="section-group-count">{group.agents.length}</span>
              </div>
              <div className="agent-grid">
                {group.agents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} onDesign={setSelectedAgent} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Backlog sidebar */}
      <div className="studio-sidebar">
        <div className="sidebar-heading">
          Agent Backlog
          {backlog.length > 0 && (
            <span className="backlog-count-badge">{backlog.length}</span>
          )}
        </div>

        {backlogSaved && (
          <div className="backlog-saved-flash">✓ Saved to backlog</div>
        )}

        {backlogLoading ? (
          <div className="sidebar-empty">Loading…</div>
        ) : backlog.length === 0 ? (
          <div className="sidebar-empty">
            <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
            No agents yet. Generate recommendations, click "Design →", then "Add to Agent Backlog".
          </div>
        ) : (
          <div className="backlog-list">
            {backlog.map((entry) => {
              const sm = STATUS_META[entry.status] || STATUS_META.backlog
              return (
                <div key={entry.id || entry.name} className="backlog-item">
                  <div className="backlog-item-top">
                    <div className="backlog-item-name" onClick={() => setSelectedAgent(entry)} style={{ cursor: 'pointer', flex: 1 }}>
                      {entry.name}
                    </div>
                    <button
                      className="backlog-remove-btn"
                      onClick={() => removeFromBacklog(entry.id)}
                      title="Remove from backlog"
                    >
                      ✕
                    </button>
                  </div>
                  {entry.fit_score > 0 && (
                    <div className="backlog-fit" style={{ color: fitColor(entry.fit_score) }}>
                      {entry.fit_score}% fit
                    </div>
                  )}
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

      {/* Design panel */}
      {selectedAgent && (
        <AgentDesignPanel
          agent={selectedAgent}
          client={client}
          vertical={vertical}
          tools={tools}
          onClose={() => setSelectedAgent(null)}
          onAddToBacklog={addToBacklog}
        />
      )}

      {showSaved && <div className="studio-saved-toast">✓ Configuration saved</div>}
    </div>
  )
}
