import { useState } from 'react'
import './EnvironmentProfile.css'

/* ── Constants ────────────────────────────────────────────────────────── */

const DEPLOYMENT_MODELS = [
  { id: 'cloud_native', label: 'Cloud Native',          desc: 'All workloads run in Azure, AWS, or GCP',             icon: '☁️' },
  { id: 'hybrid',       label: 'Hybrid',                desc: 'Mix of cloud and on-premises infrastructure',          icon: '🔀' },
  { id: 'on_prem',      label: 'Primarily On-Premises', desc: 'Most workloads run in your own data center',           icon: '🏢' },
  { id: 'air_gapped',   label: 'Air-Gapped',            desc: 'Isolated network, no direct internet access',          icon: '🔒' },
]

const CLOUD_TOOL_CATEGORIES = [
  { id: 'crm',         label: 'CRM',              tools: ['Salesforce','HubSpot','Dynamics 365','Zoho CRM','SAP CRM','Pipedrive'] },
  { id: 'erp',         label: 'ERP',              tools: ['SAP S/4HANA','Oracle ERP Cloud','NetSuite','Dynamics 365 F&O','Sage','Infor CloudSuite'] },
  { id: 'cloud',       label: 'Cloud Platform',   tools: ['Azure','Azure AI Foundry','Azure OpenAI','AWS','AWS Bedrock','GCP','Google Vertex AI','Multi-cloud'] },
  { id: 'data',        label: 'Data & Analytics', tools: ['Databricks','Snowflake','Microsoft Fabric','Power BI','Tableau','Looker','Azure Data Factory','dbt','Azure Synapse','Qlik'] },
  { id: 'itsm',        label: 'ITSM / PM',        tools: ['ServiceNow','Jira','Zendesk','Azure DevOps','Monday.com','Asana','Freshdesk','BMC Helix'] },
  { id: 'collab',      label: 'Collaboration',    tools: ['Microsoft Teams','SharePoint','OneDrive','Microsoft 365','Slack','Zoom','Webex','Google Workspace','Viva Engage'] },
  { id: 'security',    label: 'Security',         tools: ['Microsoft Sentinel','Microsoft Defender','CrowdStrike','Splunk','Palo Alto Prisma','Qualys','Tenable','Okta','Entra ID'] },
  { id: 'hr',          label: 'HR / HCM',         tools: ['Workday','SAP SuccessFactors','ADP','UKG','BambooHR','Ceridian Dayforce','Oracle HCM'] },
  { id: 'finance',     label: 'Finance',          tools: ['SAP Finance','Oracle Financials Cloud','Workiva','Anaplan','Sage Intacct','BlackLine','Concur'] },
  { id: 'supplychain', label: 'Supply Chain',     tools: ['Blue Yonder','Kinaxis','o9 Solutions','SAP IBP','Oracle SCM','E2open','Manhattan Associates'] },
  { id: 'devtools',    label: 'Dev Tools',        tools: ['GitHub','GitLab','Azure DevOps','Docker','Kubernetes','Terraform','Ansible','Jenkins'] },
  { id: 'documents',   label: 'Document Mgmt',    tools: ['SharePoint','DocuSign','Adobe Acrobat Sign','OpenText','Nintex','M-Files','Box'] },
  { id: 'ehr',         label: 'EHR / Clinical',   verticals: ['Healthcare'],        tools: ['Epic','Cerner (Oracle Health)','Meditech','Allscripts','athenahealth','eClinicalWorks','Veeva'] },
  { id: 'retail',      label: 'Retail / POS',     verticals: ['Retail'],            tools: ['Shopify','Magento','SAP Commerce','Oracle Retail','Manhattan WMS','Salesforce Commerce'] },
  { id: 'energy',      label: 'Energy / OT',      verticals: ['Energy'],            tools: ['OSIsoft PI','Honeywell','Siemens MindSphere','GE Predix','SCADA systems','Maximo'] },
]

const ON_PREM_CATEGORIES = [
  { id: 'compute',      label: 'Compute',       tools: ['Windows Server','Linux Server','VMware vSphere','Hyper-V','Nutanix','OpenStack','Azure Stack HCI','Azure Arc'] },
  { id: 'onprem_data',  label: 'Data',          tools: ['SQL Server (on-prem)','Oracle DB (on-prem)','IBM Db2','Teradata','IBM Netezza','PostgreSQL (on-prem)','MySQL (on-prem)','MongoDB (on-prem)'] },
  { id: 'storage',      label: 'Storage',       tools: ['NAS','SAN','Dell EMC','NetApp','Pure Storage','HPE Nimble','Windows File Server'] },
  { id: 'networking',   label: 'Connectivity',  tools: ['ExpressRoute','Site-to-Site VPN','MPLS','SD-WAN','Cisco','Palo Alto (on-prem)'] },
  { id: 'identity',     label: 'Identity',      tools: ['Active Directory','LDAP','ADFS','Azure AD Connect','Ping Identity','CyberArk'] },
  { id: 'ai_inference', label: 'AI / Inference', tools: ['Azure Arc (AI)','NVIDIA GPU servers','Local LLM (Ollama)','Private model hosting','Edge inference'] },
]

const LEGACY_CATEGORIES = [
  { id: 'legacy_erp',    label: 'Legacy ERP',    tools: ['SAP R/3','SAP ECC 6.0','Oracle E-Business Suite','JD Edwards','Infor M3','Epicor','BAAN'] },
  { id: 'mainframe',     label: 'Mainframe',     tools: ['IBM Mainframe (z/OS)','IBM AS/400 (iSeries)','COBOL applications','CICS','IMS','Unisys'] },
  { id: 'legacy_custom', label: 'Custom / Other', tools: ['Custom-built apps','Access databases','Excel-driven processes','FTP integrations','EDI systems','VB6 applications'] },
]

const COMPLIANCE_FRAMEWORKS = [
  { id: 'hipaa',    label: 'HIPAA',       desc: 'Healthcare data',           verticals: ['Healthcare'] },
  { id: 'fedramp',  label: 'FedRAMP',     desc: 'US Federal',                verticals: ['Public Sector'] },
  { id: 'itar',     label: 'ITAR',        desc: 'Defense / Export control',  verticals: ['Public Sector'] },
  { id: 'pci',      label: 'PCI-DSS',     desc: 'Payment card data',         verticals: ['Financial Services','Retail'] },
  { id: 'gdpr',     label: 'GDPR',        desc: 'EU data residency',         verticals: [] },
  { id: 'soc2',     label: 'SOC 2',       desc: 'Service organization',      verticals: [] },
  { id: 'iso27001', label: 'ISO 27001',   desc: 'Information security',      verticals: [] },
  { id: 'nist',     label: 'NIST AI RMF', desc: 'AI risk management',        verticals: [] },
  { id: 'cmmc',     label: 'CMMC',        desc: 'Defense contractors',       verticals: ['Public Sector'] },
  { id: 'sox',      label: 'SOX',         desc: 'Financial reporting',       verticals: ['Financial Services'] },
]

const CONSTRAINTS = [
  { id: 'data_residency',  label: 'Data Residency Requirements',  desc: 'Data cannot leave a specific geographic region' },
  { id: 'no_cloud_ai',     label: 'No External AI APIs',          desc: 'AI model calls cannot go to third-party cloud services' },
  { id: 'change_control',  label: 'Strict Change Control',        desc: 'All changes require formal approval process' },
  { id: 'vendor_approval', label: 'Vendor Approval Process',      desc: 'New software vendors require IT/security approval' },
]

const ALL_PREDEFINED = new Set([
  ...CLOUD_TOOL_CATEGORIES.flatMap(c => c.tools),
  ...ON_PREM_CATEGORIES.flatMap(c => c.tools),
  ...LEGACY_CATEGORIES.flatMap(c => c.tools),
])

const INDUSTRIES = [
  'Financial Services','Healthcare','Manufacturing','Retail',
  'Energy','Professional Services','Public Sector','Technology',
]

const STEP_LABELS = ['Deployment Model','Infrastructure & Tools','Compliance','Legacy Systems']

/* ── ToolCategoryRow ──────────────────────────────────────────────────── */
function ToolCategoryRow({ cat, selected, catMap, addingTo, addVal, setAddVal, onToggle, onAdd, onRemove, onStartAdding, sectionKey }) {
  const customInRow  = selected.filter(t => catMap[t] === cat.id && !ALL_PREDEFINED.has(t))
  const isAddingHere = addingTo?.section === sectionKey && addingTo?.catId === cat.id

  function commit() {
    const v = addVal.trim()
    if (v && !selected.includes(v)) onAdd(cat.id, v)
    setAddVal('')
    onStartAdding(null)
  }

  return (
    <div className="ep-tool-row">
      <div className="ep-tool-label">{cat.label}</div>
      <div className="ep-tool-chips">
        {cat.tools.map(tool => (
          <button
            key={tool}
            className={`ep-chip${selected.includes(tool) ? ' selected' : ''}`}
            onClick={() => onToggle(tool, cat.id)}
          >
            {tool}
          </button>
        ))}
        {customInRow.map(tool => (
          <span key={tool} className="ep-chip selected ep-custom-chip">
            {tool}
            <button className="ep-chip-remove" onClick={() => onRemove(tool)}>×</button>
          </span>
        ))}
        {isAddingHere ? (
          <input
            className="ep-add-input"
            autoFocus
            value={addVal}
            onChange={e => setAddVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAddVal(''); onStartAdding(null) } }}
            onBlur={commit}
            placeholder="Type tool name…"
          />
        ) : (
          <button className="ep-add-btn" onClick={() => onStartAdding({ section: sectionKey, catId: cat.id })}>
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function EnvironmentProfile({ client, onComplete, onSkip }) {
  const ep = client?.environmentProfile

  const [step,                 setStep]                 = useState(1)
  const [saving,               setSaving]               = useState(false)
  const [vertical,             setVertical]             = useState(ep?.vertical || client?.industry || '')
  const [deploymentModel,      setDeploymentModel]      = useState(ep?.deploymentModel || 'cloud_native')
  const [cloudTools,           setCloudTools]           = useState(ep?.cloudTools || [])
  const [cloudToolCategoryMap, setCloudToolCategoryMap] = useState(ep?.cloudToolCategoryMap || {})
  const [onPremTools,          setOnPremTools]          = useState(ep?.onPremTools || [])
  const [onPremCategoryMap,    setOnPremCategoryMap]    = useState(ep?.onPremCategoryMap || {})
  const [legacySystems,        setLegacySystems]        = useState(ep?.legacySystems || [])
  const [legacyCategoryMap,    setLegacyCategoryMap]    = useState(ep?.legacyCategoryMap || {})
  const [complianceFrameworks, setComplianceFrameworks] = useState(ep?.complianceFrameworks || [])
  const [constraints,          setConstraints]          = useState(ep?.constraints || [])
  const [addingTo,             setAddingTo]             = useState(null)
  const [addVal,               setAddVal]               = useState('')

  const showOnPrem = ['hybrid','on_prem','air_gapped'].includes(deploymentModel)

  /* ── Cloud tool handlers ─────────────────────────────────────────────── */
  function toggleCloudTool(tool, catId) {
    setCloudTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
    if (catId && !cloudToolCategoryMap[tool]) {
      setCloudToolCategoryMap(prev => ({ ...prev, [tool]: catId }))
    }
  }
  function addCustomCloud(catId, val) {
    setCloudTools(prev => [...prev, val])
    setCloudToolCategoryMap(prev => ({ ...prev, [val]: catId }))
  }
  function removeCustomCloud(tool) {
    setCloudTools(prev => prev.filter(t => t !== tool))
    setCloudToolCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  /* ── On-prem tool handlers ───────────────────────────────────────────── */
  function toggleOnPremTool(tool, catId) {
    setOnPremTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
    if (catId && !onPremCategoryMap[tool]) {
      setOnPremCategoryMap(prev => ({ ...prev, [tool]: catId }))
    }
  }
  function addCustomOnPrem(catId, val) {
    setOnPremTools(prev => [...prev, val])
    setOnPremCategoryMap(prev => ({ ...prev, [val]: catId }))
  }
  function removeCustomOnPrem(tool) {
    setOnPremTools(prev => prev.filter(t => t !== tool))
    setOnPremCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  /* ── Legacy system handlers ──────────────────────────────────────────── */
  function toggleLegacy(tool, catId) {
    setLegacySystems(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
    if (catId && !legacyCategoryMap[tool]) {
      setLegacyCategoryMap(prev => ({ ...prev, [tool]: catId }))
    }
  }
  function addCustomLegacy(catId, val) {
    setLegacySystems(prev => [...prev, val])
    setLegacyCategoryMap(prev => ({ ...prev, [val]: catId }))
  }
  function removeCustomLegacy(tool) {
    setLegacySystems(prev => prev.filter(t => t !== tool))
    setLegacyCategoryMap(prev => { const n = { ...prev }; delete n[tool]; return n })
  }

  /* ── Compliance / constraint handlers ───────────────────────────────── */
  function toggleCompliance(id) {
    setComplianceFrameworks(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }
  function toggleConstraint(id) {
    setConstraints(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  /* ── Save ────────────────────────────────────────────────────────────── */
  async function save() {
    setSaving(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiBase}/api/clients/${client.id}/environment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentModel, cloudTools, cloudToolCategoryMap,
          onPremTools, onPremCategoryMap, legacySystems,
          legacyCategoryMap, complianceFrameworks, constraints, vertical,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onComplete(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  /* ── Sorted compliance (vertical-relevant first) ─────────────────────── */
  const sortedCompliance = [...COMPLIANCE_FRAMEWORKS].sort((a, b) => {
    const aRel = a.verticals.includes(vertical) ? 1 : 0
    const bRel = b.verticals.includes(vertical) ? 1 : 0
    return bRel - aRel
  })

  /* ── Deploy model label ─────────────────────────────────────────────── */
  const currentDeploy = DEPLOYMENT_MODELS.find(d => d.id === deploymentModel)

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="ep-overlay">
      <div className="ep-modal">
        {/* Header */}
        <div className="ep-header">
          <div className="ep-header-left">
            <div className="ep-title">Client Environment Profile</div>
            <div className="ep-subtitle">{client?.name || 'Set up'} — step {step} of 4</div>
          </div>
          {onSkip && (
            <button className="ep-skip-btn" onClick={onSkip}>Skip for now</button>
          )}
        </div>

        {/* Step dots */}
        <div className="ep-steps">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              className={`ep-step-dot${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}
              onClick={() => setStep(i + 1)}
              title={label}
            >
              <span className="ep-step-num">{step > i + 1 ? '✓' : i + 1}</span>
              <span className="ep-step-label">{label}</span>
            </button>
          ))}
          <div className="ep-step-line" />
        </div>

        {/* ── Step 1 — Deployment Model ──────────────────────────────────── */}
        {step === 1 && (
          <div className="ep-body">
            <div className="ep-field-group">
              <label className="ep-field-label">Industry Vertical</label>
              <select
                className="ep-select"
                value={vertical}
                onChange={e => setVertical(e.target.value)}
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>

            <div className="ep-field-group">
              <label className="ep-field-label">How is this client's infrastructure deployed?</label>
              <p className="ep-field-hint">This determines which agent architectures are feasible.</p>
              <div className="ep-deploy-grid">
                {DEPLOYMENT_MODELS.map(model => (
                  <button
                    key={model.id}
                    className={`ep-deploy-card${deploymentModel === model.id ? ' selected' : ''}`}
                    onClick={() => setDeploymentModel(model.id)}
                  >
                    <div className="ep-deploy-icon">{model.icon}</div>
                    <div className="ep-deploy-label">{model.label}</div>
                    <div className="ep-deploy-desc">{model.desc}</div>
                  </button>
                ))}
              </div>

              {deploymentModel === 'air_gapped' && (
                <div className="ep-airgap-warning">
                  ⚠️ Air-gapped environment: agent recommendations will be limited to fully on-premises architectures. Local model inference (e.g. Ollama, private GPU) is required.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2 — Infrastructure & Tools ────────────────────────────── */}
        {step === 2 && (
          <div className="ep-body">
            <div className="ep-field-group">
              <label className="ep-field-label">
                Cloud Tooling Stack
                {vertical && <span className="ep-field-tag">{vertical} tools highlighted</span>}
              </label>
              <p className="ep-field-hint">Select all SaaS and cloud platform tools in the client's environment.</p>
              <div className="ep-tool-categories">
                {CLOUD_TOOL_CATEGORIES
                  .filter(cat => !cat.verticals || cat.verticals.includes(vertical) || !vertical)
                  .map(cat => (
                    <ToolCategoryRow
                      key={cat.id}
                      cat={cat}
                      selected={cloudTools}
                      catMap={cloudToolCategoryMap}
                      addingTo={addingTo}
                      addVal={addVal}
                      setAddVal={setAddVal}
                      onToggle={toggleCloudTool}
                      onAdd={addCustomCloud}
                      onRemove={removeCustomCloud}
                      onStartAdding={setAddingTo}
                      sectionKey="cloud"
                    />
                  ))}
              </div>
            </div>

            {showOnPrem && (
              <div className="ep-field-group">
                <label className="ep-field-label">
                  🏢 On-Premises Infrastructure
                </label>
                <p className="ep-field-hint">Select hardware, virtualization, storage, and networking components running in the client's data center.</p>
                <div className="ep-tool-categories">
                  {ON_PREM_CATEGORIES.map(cat => (
                    <ToolCategoryRow
                      key={cat.id}
                      cat={cat}
                      selected={onPremTools}
                      catMap={onPremCategoryMap}
                      addingTo={addingTo}
                      addVal={addVal}
                      setAddVal={setAddVal}
                      onToggle={toggleOnPremTool}
                      onAdd={addCustomOnPrem}
                      onRemove={removeCustomOnPrem}
                      onStartAdding={setAddingTo}
                      sectionKey="onprem"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 — Compliance & Constraints ──────────────────────────── */}
        {step === 3 && (
          <div className="ep-body">
            <div className="ep-field-group">
              <label className="ep-field-label">Compliance & Data Residency</label>
              <p className="ep-field-hint">
                Select all applicable frameworks. Selections constrain agent architecture and are shown on every agent recommendation.
                {vertical && <> Frameworks relevant to <strong>{vertical}</strong> are highlighted.</>}
              </p>
              <div className="ep-compliance-chips">
                {sortedCompliance.map(fw => {
                  const isRelevant = fw.verticals.includes(vertical)
                  const isSelected = complianceFrameworks.includes(fw.id)
                  return (
                    <button
                      key={fw.id}
                      className={`ep-compliance-chip${isSelected ? ' selected' : ''}${isRelevant ? ' priority' : ''}`}
                      onClick={() => toggleCompliance(fw.id)}
                    >
                      <span className="ep-cc-label">{fw.label}</span>
                      <span className="ep-cc-desc">{fw.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="ep-field-group">
              <label className="ep-field-label">Additional Constraints</label>
              <p className="ep-field-hint">Flag any constraints that affect what solutions can be deployed.</p>
              <div className="ep-constraints">
                {CONSTRAINTS.map(c => {
                  const on = constraints.includes(c.id)
                  return (
                    <div key={c.id} className={`ep-constraint-row${on ? ' on' : ''}`} onClick={() => toggleConstraint(c.id)}>
                      <div className="ep-constraint-text">
                        <div className="ep-constraint-label">{c.label}</div>
                        <div className="ep-constraint-desc">{c.desc}</div>
                      </div>
                      <div className={`ep-toggle${on ? ' on' : ''}`}>
                        <div className="ep-toggle-knob" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4 — Legacy Systems + Summary ──────────────────────────── */}
        {step === 4 && (
          <div className="ep-body">
            <div className="ep-field-group">
              <label className="ep-field-label">Legacy & Custom Systems</label>
              <p className="ep-field-hint">Legacy systems are often the highest-value agent integration targets — they usually lack APIs and cause the most manual work.</p>
              <div className="ep-tool-categories">
                {LEGACY_CATEGORIES.map(cat => (
                  <ToolCategoryRow
                    key={cat.id}
                    cat={cat}
                    selected={legacySystems}
                    catMap={legacyCategoryMap}
                    addingTo={addingTo}
                    addVal={addVal}
                    setAddVal={setAddVal}
                    onToggle={toggleLegacy}
                    onAdd={addCustomLegacy}
                    onRemove={removeCustomLegacy}
                    onStartAdding={setAddingTo}
                    sectionKey="legacy"
                  />
                ))}
              </div>
              {legacySystems.length === 0 && (
                <button
                  className={`ep-none-chip${legacySystems.length === 0 ? ' selected' : ''}`}
                  style={{ marginTop: 8 }}
                  onClick={() => {}}
                >
                  ✓ None — all systems are modern
                </button>
              )}
            </div>

            {/* Summary review card */}
            <div className="ep-summary-card">
              <div className="ep-summary-title">Profile Summary</div>
              <div className="ep-summary-rows">
                <div className="ep-summary-row">
                  <span className="ep-summary-key">Vertical</span>
                  <span className="ep-summary-val">{vertical || 'Not set'}</span>
                </div>
                <div className="ep-summary-row">
                  <span className="ep-summary-key">Deployment</span>
                  <span className="ep-summary-val">{currentDeploy?.icon} {currentDeploy?.label}</span>
                </div>
                <div className="ep-summary-row">
                  <span className="ep-summary-key">Cloud Tools</span>
                  <span className="ep-summary-val">
                    {cloudTools.length > 0
                      ? <>{cloudTools.length} selected <span className="ep-summary-hint">({cloudTools.slice(0, 3).join(', ')}{cloudTools.length > 3 ? ` +${cloudTools.length - 3} more` : ''})</span></>
                      : <span className="ep-summary-hint">None selected</span>
                    }
                  </span>
                </div>
                {showOnPrem && (
                  <div className="ep-summary-row">
                    <span className="ep-summary-key">On-Prem</span>
                    <span className="ep-summary-val">
                      {onPremTools.length > 0
                        ? <>{onPremTools.length} selected <span className="ep-summary-hint">({onPremTools.slice(0, 2).join(', ')}{onPremTools.length > 2 ? ` +${onPremTools.length - 2} more` : ''})</span></>
                        : <span className="ep-summary-hint">None selected</span>
                      }
                    </span>
                  </div>
                )}
                <div className="ep-summary-row">
                  <span className="ep-summary-key">Legacy</span>
                  <span className="ep-summary-val">
                    {legacySystems.length > 0
                      ? <>{legacySystems.length} system{legacySystems.length !== 1 ? 's' : ''} <span className="ep-summary-hint">({legacySystems.slice(0, 2).join(', ')}{legacySystems.length > 2 ? ` +${legacySystems.length - 2} more` : ''})</span></>
                      : <span className="ep-summary-hint">None (all modern)</span>
                    }
                  </span>
                </div>
                <div className="ep-summary-row">
                  <span className="ep-summary-key">Compliance</span>
                  <span className="ep-summary-val">
                    {complianceFrameworks.length > 0
                      ? complianceFrameworks.map(id => COMPLIANCE_FRAMEWORKS.find(f => f.id === id)?.label).filter(Boolean).join(', ')
                      : <span className="ep-summary-hint">None selected</span>
                    }
                  </span>
                </div>
                {constraints.length > 0 && (
                  <div className="ep-summary-row">
                    <span className="ep-summary-key">Constraints</span>
                    <span className="ep-summary-val">
                      {constraints.map(id => CONSTRAINTS.find(c => c.id === id)?.label).filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="ep-footer">
          <div className="ep-footer-left">
            {step > 1 && (
              <button className="ep-btn ep-btn-ghost" onClick={() => setStep(s => s - 1)}>
                ← Back
              </button>
            )}
          </div>
          <div className="ep-footer-right">
            {step < 4 ? (
              <button className="ep-btn ep-btn-primary" onClick={() => setStep(s => s + 1)}>
                Next →
              </button>
            ) : (
              <button className="ep-btn ep-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Environment Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
