import { Router } from 'express'
import { containers } from '../db.js'
import { fixMermaidChart } from '../utils/mermaid.js'

const router = Router()

// ── Cosmos DB persistence ────────────────────────────────────────────────────

// GET /api/cloud-modernization/clients/:id/cloud-modernization
router.get('/clients/:id/cloud-modernization', async (req, res) => {
  try {
    const { resource } = await containers.clients
      .item(req.params.id, req.params.id).read()
    const cm = resource?.cloudModernization
    if (!cm?.sessions?.length) return res.json({ hasResults: false })
    const s = cm.sessions[0]
    res.json({
      hasResults:    true,
      workloads:     s.workloads,
      targetCloud:   s.targetCloud,
      timeline:      s.timeline,
      budgetRange:   s.budgetRange,
      constraints:   s.constraints,
      calcResult:    s.calcResult,
      scoringResult: s.scoringResult,
      blueprint:     s.blueprint,
      sessionCount:  cm.sessions.length,
      lastUpdated:   cm.updatedAt,
    })
  } catch (err) {
    console.error('cm GET client error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cloud-modernization/clients/:id/cloud-modernization
router.post('/clients/:id/cloud-modernization', async (req, res) => {
  try {
    const { resource: client } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!client.cloudModernization) client.cloudModernization = { sessions: [] }

    const session = {
      id:        `cm-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body,
    }

    client.cloudModernization.sessions.unshift(session)
    if (client.cloudModernization.sessions.length > 10) {
      client.cloudModernization.sessions = client.cloudModernization.sessions.slice(0, 10)
    }
    client.cloudModernization.updatedAt = new Date().toISOString()
    client.updatedAt                    = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(client)
    res.json(updated)
  } catch (err) {
    console.error('cm POST client error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── AI helper ────────────────────────────────────────────────────────────────

async function getAiClient() {
  const { AzureOpenAI } = await import('openai')
  return new AzureOpenAI({
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:     process.env.AZURE_OPENAI_KEY,
    apiVersion: '2024-08-01-preview',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  })
}

function parseJson(raw) {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const first = clean.indexOf('{')
  const last  = clean.lastIndexOf('}')
  if (first === -1 || last === -1) throw new Error('No JSON object found in AI response')
  return JSON.parse(clean.slice(first, last + 1))
}

// ── POST /api/cloud-modernization/parse-csv ──────────────────────────────────

router.post('/parse-csv', async (req, res) => {
  try {
    // Accept both 'csv' (frontend) and 'csvContent' (legacy) field names
    const raw = req.body.csv || req.body.csvContent
    console.log('parse-csv called, content length:', raw?.length ?? 0)

    if (!raw?.trim()) {
      return res.status(400).json({ error: 'csv content is required' })
    }

    const aiClient = await getAiClient()
    const truncated = raw.slice(0, 3000)

    const prompt = `Parse this infrastructure inventory CSV and extract workload data. Return ONLY raw JSON with no markdown fences.

CSV:
${truncated}

Map these columns flexibly (column names may vary):
- name: VM name / server name / hostname / workload name
- type: OS/role → "Windows VM" | "Linux VM" | "Web App" | "Database" | "Container" | "Other"
- platform: current host → "VMware vSphere" | "Hyper-V" | "Physical/Bare Metal" | "Azure" | "AWS" | "GCP" | "Other On-Prem"
- vcpu: vCPU / CPU count / cores — integer
- ramGb: RAM GB / memory GB — integer
- storageTb: storage TB (convert GB→TB if needed) — number
- criticality: "Critical" | "High" | "Medium" | "Low" (default "Medium")
- changeSensitivity: "Low" | "Medium" | "High" | "Very High" (default "Medium")
- dataResidency: "US Only" | "EU Only" | "Global OK" | "Sovereign Required" (default "US Only")
- notes: any free-text notes, role, or app description

Return this exact JSON:
{
  "workloads": [
    {
      "name": "string",
      "type": "Windows VM",
      "platform": "VMware vSphere",
      "vcpu": 4,
      "ramGb": 16,
      "storageTb": 0.5,
      "criticality": "Medium",
      "changeSensitivity": "Medium",
      "dataResidency": "US Only",
      "notes": "string"
    }
  ],
  "totalRows": 0,
  "parsedRows": 0,
  "unmappedColumns": []
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens:  4000,
    })

    const responseRaw = completion.choices[0].message.content
    console.log('parse-csv finish_reason:', completion.choices[0].finish_reason)
    console.log('parse-csv response (first 300):', responseRaw.slice(0, 300))

    let result
    try {
      result = parseJson(responseRaw)
    } catch (parseErr) {
      console.error('parse-csv JSON parse failed:', parseErr.message)
      return res.status(500).json({ error: 'AI returned invalid JSON', detail: parseErr.message })
    }

    if (!Array.isArray(result.workloads)) {
      console.error('parse-csv: missing workloads array', Object.keys(result))
      return res.status(500).json({ error: 'AI response missing workloads array' })
    }

    console.log('parse-csv success:', result.workloads.length, 'workloads')
    res.json(result)
  } catch (err) {
    console.error('parse-csv error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/cloud-modernization/vmware-calculator ──────────────────────────
// Accepts frontend fields: { vmCount, vcpu, ramGb, storageTb, currentCost }

router.post('/vmware-calculator', async (req, res) => {
  try {
    const {
      vmCount          = 0,
      // frontend field names
      vcpu             = 0,
      ramGb            = 0,
      storageTb        = 0,
      currentCost      = 0,
      // legacy field names (backwards compat)
      avgVcpu,
      avgRamGb,
      avgStorageGb,
      currentAnnualLicenseCost,
      contractRenewalMonths = 24,
    } = req.body

    const totalVcpu      = vcpu      || (vmCount * (avgVcpu    || 4))
    const totalRamGb     = ramGb     || (vmCount * (avgRamGb   || 16))
    const totalStorageTb = storageTb || ((vmCount * (avgStorageGb || 500)) / 1024)
    // currentCost is monthly; convert to annual if provided
    const currentMonthly = currentCost || (currentAnnualLicenseCost ? Math.round(currentAnnualLicenseCost / 12) : 0)
    const currentAnnual  = currentMonthly * 12

    // AVS sizing — AV36P node: 36 vCPU, 576 GB RAM, 15.2 TB storage, ~$7,200/month
    const AVS_NODE_PRICE  = 7200
    const AVS_NODE_VCPU   = 36
    const AVS_NODE_RAM    = 576
    const AVS_NODE_STOR   = 15.2

    const nodesByVcpu    = Math.ceil(totalVcpu    / AVS_NODE_VCPU)
    const nodesByRam     = Math.ceil(totalRamGb   / AVS_NODE_RAM)
    const nodesByStorage = Math.ceil(totalStorageTb / AVS_NODE_STOR)
    const avsNodes       = Math.max(nodesByVcpu, nodesByRam, nodesByStorage, 3)

    const avsMonthly  = avsNodes * AVS_NODE_PRICE
    const avsAnnual   = avsMonthly * 12

    // Azure IaaS — benchmark $280/VM/month
    const iaasMonthly = Math.max(vmCount, 1) * 280
    const iaasAnnual  = iaasMonthly * 12

    // Nutanix on-prem — ~1 node per 20 VMs at ~$2,000/node/month
    const nutanixNodes   = Math.max(Math.ceil(Math.max(vmCount, 1) / 20), 3)
    const nutanixMonthly = nutanixNodes * 2000
    const nutanixAnnual  = nutanixMonthly * 12

    // Recommendation
    const cheapest = Math.min(avsMonthly, iaasMonthly, nutanixMonthly)
    let recommendation = ''
    if (cheapest === iaasMonthly) {
      recommendation = `Azure IaaS offers the best cost profile at ${formatCurrency(iaasMonthly)}/month${currentMonthly ? `, saving ${formatCurrency(currentMonthly - iaasMonthly)}/month vs current VMware` : ''}. Requires 3–6 months for re-IP and app validation.`
    } else if (cheapest === avsMonthly) {
      recommendation = `Azure VMware Solution (${avsNodes} AV36P nodes) is the fastest path at ${formatCurrency(avsMonthly)}/month — migrate in days with zero app changes. Rehost phase-1, then modernize over 12–18 months.`
    } else {
      recommendation = `Nutanix (${nutanixNodes} nodes) is the lowest cost at ${formatCurrency(nutanixMonthly)}/month while staying on-prem. Good if cloud migration is blocked by compliance or bandwidth constraints.`
    }

    res.json({
      currentMonthly,
      currentAnnual,
      avsMonthly,
      avsAnnual,
      avsNodes,
      iaasMonthly,
      iaasAnnual,
      nutanixMonthly,
      nutanixAnnual,
      nutanixNodes,
      recommendation,
      sizing: { totalVcpu, totalRamGb, totalStorageTb: +totalStorageTb.toFixed(1) },
      urgency: contractRenewalMonths <= 6 ? 'critical' : contractRenewalMonths <= 12 ? 'high' : 'standard',
      disclaimer: 'Estimates for planning purposes only. AVS: AV36P ~$7,200/node/month, min 3 nodes. Azure IaaS: benchmark $280/VM/month. Nutanix: benchmark $2,000/node/month. Request formal quotes before committing.',
    })
  } catch (err) {
    console.error('vmware-calculator error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

function formatCurrency(n) {
  if (!n || isNaN(n)) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

// ── POST /api/cloud-modernization/score-workloads ────────────────────────────
// Frontend sends: { clientId, workloads, targetCloud, constraints, complianceReqs, haRequirement, drRequirement }

router.post('/score-workloads', async (req, res) => {
  try {
    const {
      workloads      = [],
      targetCloud    = 'Azure',
      constraints    = '',
      complianceReqs = [],
      haRequirement  = false,
      drRequirement  = false,
      // legacy / optional
      clientId,
      clientName,
      vertical,
    } = req.body

    console.log('score-workloads called:', workloads.length, 'workloads, target:', targetCloud)

    if (!workloads.length) {
      return res.status(400).json({ error: 'workloads array is required' })
    }

    const aiClient = await getAiClient()

    const workloadLines = workloads
      .filter(w => w.name)
      .map((w, i) =>
        `${i + 1}. ${w.name} — Type: ${w.type || '?'}, Platform: ${w.platform || '?'}, ` +
        `vCPU: ${w.vcpu || '?'}, RAM: ${w.ramGb || '?'} GB, Storage: ${w.storageTb || '?'} TB, ` +
        `Criticality: ${w.criticality || 'Medium'}, Change sensitivity: ${w.changeSensitivity || 'Medium'}, ` +
        `Data residency: ${w.dataResidency || 'Flexible'}, Notes: ${w.notes || 'none'}`
      ).join('\n')

    const prompt = `You are a senior cloud modernization architect applying the 6R framework to score workloads for migration to ${targetCloud}.

WORKLOADS:
${workloadLines}

REQUIREMENTS:
- Compliance: ${complianceReqs.length ? complianceReqs.join(', ') : 'standard'}
- High Availability required: ${haRequirement}
- Disaster Recovery required: ${drRequirement}
- Constraints: ${constraints || 'none'}

6R DEFINITIONS:
- Rehost: lift-and-shift to ${targetCloud} IaaS. Minimal changes. Fast.
- Replatform: containerize (AKS) or move to managed OS — no code changes
- Refactor: re-architect to PaaS (App Service, Functions, Azure SQL Managed Instance, Cosmos DB)
- Repurchase: replace with SaaS equivalent (Atlassian Cloud, GitHub, Microsoft 365, etc.)
- Retire: decommission — workload is not needed
- Retain: keep on-premises (compliance-blocked, too risky, or not cloud-ready)

SCORING RULES:
- Critical + cannot be changed → Retain or Rehost
- VMware workload → Rehost default; consider Azure VMware Solution as a bridge
- Web apps / APIs → strong Refactor candidate to Azure App Service
- SQL Server databases → evaluate Azure SQL Managed Instance (Replatform) before IaaS Rehost
- SAP / Oracle ERP → Rehost only (never Refactor — too complex)
- Sovereign data residency → Retain or on-prem only — never cloud
- Windows Server 2008/2012 → flag as end-of-life risk (extended support ended Jan 2020 / Oct 2023)
- Dev/Test workloads → strong Retire or Repurchase candidate

CONSOLIDATION RULES:
- 3+ Windows file servers → recommend Azure Files or Azure NetApp Files consolidation instead of individual Rehost; flag in rationale
- Multiple SQL Server VMs of same version → evaluate Azure SQL Elastic Pool or Managed Instance consolidation
- Multiple web frontends on same tech stack → evaluate Azure App Service plan consolidation

REPURCHASE EVALUATION:
- Bitbucket → evaluate Atlassian Cloud as Repurchase (flag in rationale)
- Jenkins → evaluate Azure DevOps Pipelines or GitHub Actions as Repurchase
- Confluence / Jira → evaluate Atlassian Cloud as Repurchase
- Grafana / Prometheus monitoring → evaluate Azure Monitor + Managed Grafana as Repurchase
- Any on-prem email/calendar → evaluate Microsoft 365

NAMING — strictly follow these:
- Never say "Azure AD" — always say "Microsoft Entra ID"
- Never say "Azure Active Directory" — always say "Microsoft Entra ID"
- Use "Azure SQL Managed Instance" not "Azure SQL MI"

Assign each workload a wave (1 = quick wins / low risk, 2 = core migration, 3 = complex / critical / last).

Return ONLY raw JSON:
{
  "workloads": [
    {
      "name": "exact name from inventory",
      "recommendation": "Rehost|Replatform|Refactor|Repurchase|Retire|Retain",
      "recommendedPath": "specific Azure target e.g. Azure SQL Managed Instance | Azure App Service | Azure IaaS D4s_v3 | Atlassian Cloud | Azure Files",
      "rationale": "2 sentences specific to this workload — reference OS, app stack, or compliance impact",
      "effort": "Low|Medium|High",
      "risk": "Low|Medium|High",
      "wave": 1,
      "waveRationale": "Why this wave — dependency, risk level, quick win, etc.",
      "endOfLifeRisk": false,
      "endOfLifeDetail": "e.g. Windows Server 2012 R2 — extended support ended Oct 2023",
      "consolidationNote": "if applicable, note consolidation opportunity",
      "repurchaseAlternative": "if applicable, name the SaaS alternative"
    }
  ],
  "summary": "3-4 sentences on the overall migration approach, naming the key workload groups"
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens:  4000,
    })

    const raw = completion.choices[0].message.content
    console.log('score-workloads finish_reason:', completion.choices[0].finish_reason)

    let result
    try {
      result = parseJson(raw)
    } catch (parseErr) {
      console.error('score-workloads JSON parse failed:', parseErr.message)
      return res.status(500).json({ error: 'AI returned invalid JSON', detail: parseErr.message })
    }

    console.log('score-workloads success:', result.workloads?.length, 'scored')
    res.json(result)
  } catch (err) {
    console.error('score-workloads error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/cloud-modernization/blueprint ──────────────────────────────────
// Frontend sends: { clientId, workloads, scoringResult, calcResult, targetCloud, timeline,
//                   budgetRange, constraints, complianceReqs, haRequirement, drRequirement,
//                   managedServices, networkArch, additionalReqs }

router.post('/blueprint', async (req, res) => {
  try {
    const {
      workloads      = [],
      scoringResult,
      calcResult,
      targetCloud    = 'Azure',
      timeline       = '12 months',
      budgetRange    = '',
      constraints    = '',
      complianceReqs = [],
      haRequirement  = false,
      drRequirement  = false,
      managedServices = true,
      networkArch    = 'Hub-Spoke',
      additionalReqs = '',
      advisorAnswers = '',
      clientId,
    } = req.body

    console.log('blueprint called: workloads', workloads.length, 'target', targetCloud)

    // Get client name if clientId provided
    let clientName = 'Client'
    if (clientId) {
      try {
        const { resource } = await containers.clients.item(clientId, clientId).read()
        if (resource?.name) clientName = resource.name
      } catch (_) {}
    }

    const aiClient = await getAiClient()

    const scored  = scoringResult?.workloads || []
    const wave1   = scored.filter(w => w.wave === 1 || (!w.wave && w.effort === 'Low')).slice(0, 8)
    const wave2   = scored.filter(w => w.wave === 2 || (!w.wave && w.effort === 'Medium')).slice(0, 8)
    const wave3   = scored.filter(w => w.wave === 3 || (!w.wave && w.effort === 'High')).slice(0, 8)

    // Fall back: distribute remaining workloads if wave fields weren't set
    if (wave1.length === 0 && wave2.length === 0 && wave3.length === 0 && scored.length > 0) {
      const chunk = Math.ceil(scored.length / 3)
      wave1.push(...scored.slice(0, chunk))
      wave2.push(...scored.slice(chunk, chunk * 2))
      wave3.push(...scored.slice(chunk * 2))
    }

    function buildWaveDetail(wls) {
      if (!wls.length) return 'None'
      return wls.map(w =>
        `  - ${w.name}: ${w.recommendation} → ${w.recommendedPath || w.recommendation}` +
        (w.endOfLifeRisk ? ' ⚠ END-OF-LIFE' : '') +
        (w.consolidationNote ? ` [${w.consolidationNote}]` : '') +
        `\n    Rationale: ${w.rationale || 'no rationale'}` +
        `\n    Effort: ${w.effort || '?'} · Risk: ${w.risk || '?'}` +
        (w.waveRationale ? `\n    Wave rationale: ${w.waveRationale}` : '')
      ).join('\n')
    }

    const rDist = scored.reduce((acc, w) => {
      acc[w.recommendation] = (acc[w.recommendation] || 0) + 1
      return acc
    }, {})
    const distStr = Object.entries(rDist).map(([r, n]) => `${r}: ${n}`).join(' | ')

    const eolWorkloads = scored.filter(w => w.endOfLifeRisk)
    const consolidation = scored.filter(w => w.consolidationNote).map(w => `${w.name}: ${w.consolidationNote}`)
    const repurchase    = scored.filter(w => w.repurchaseAlternative).map(w => `${w.name} → ${w.repurchaseAlternative}`)

    const prompt = `You are a senior cloud solutions architect at Zones generating a detailed migration blueprint for a client engagement.

Client: ${clientName}
Target cloud: ${targetCloud}
Timeline: ${timeline}
Budget: ${budgetRange || 'not specified'}
Network architecture: ${networkArch}
High availability required: ${haRequirement}
Disaster recovery required: ${drRequirement}
Prefer managed services (PaaS): ${managedServices}
Compliance: ${complianceReqs.length ? complianceReqs.join(', ') : 'standard'}
Constraints: ${constraints || 'none'}
Additional requirements: ${additionalReqs || 'none'}

WORKLOAD SUMMARY: ${scored.length} workloads total
Distribution: ${distStr || 'not scored'}
End-of-life workloads: ${eolWorkloads.map(w => w.name).join(', ') || 'none'}

SCORED WORKLOADS BY WAVE — reference by EXACT NAME in all phases:

Wave 1 (Quick wins — low risk, fast value):
${buildWaveDetail(wave1)}

Wave 2 (Core migration):
${buildWaveDetail(wave2)}

Wave 3 (Complex, critical, or modernization):
${buildWaveDetail(wave3)}

CONSOLIDATION OPPORTUNITIES (from scoring):
${consolidation.join('\n') || 'None identified'}

REPURCHASE ALTERNATIVES (from scoring):
${repurchase.join('\n') || 'None identified'}

${advisorAnswers ? `ADVISOR ANSWERS TO PREVIOUS QUESTIONS — incorporate these into the refined blueprint:
${advisorAnswers}

Update the migration plan, risk assessment, cost estimate, and architecture diagram to reflect these answers. If an answer clarifies a workload type, dependency, or constraint, update the relevant phase and workload details accordingly.

` : ''}CRITICAL RULES — follow every one:
1. Reference workloads by EXACT names from the inventory — never generic names like "File Server 1" or "VM-001"
2. For each task: include the specific workload name, the responsible role, the duration, and the output/deliverable
3. End-of-life workloads (${eolWorkloads.map(w => w.name).join(', ') || 'none'}) must be called out explicitly as security risks with upgrade path
4. Never say "Azure AD" — always say "Microsoft Entra ID"
5. Never say "Azure Active Directory" — always say "Microsoft Entra ID"
6. Cost estimates must break down into three categories: Azure consumption / Zones professional services / tooling and licenses
7. Include RPO/RTO targets for any ${complianceReqs.length ? complianceReqs.join('/') : 'compliance-scoped'} workloads
8. For each consolidation opportunity, show the cost delta vs individual migration
9. The "Questions for the client" section must reference specific workload names and constraints
10. The architecture diagram must reference actual Azure services chosen for the specific workloads — not generic boxes

Return ONLY raw JSON:
{
  "summary": "3-4 sentence executive summary naming specific workloads and the primary modernization strategy for ${clientName}",
  "phases": [
    {
      "name": "Phase 1 — Discovery and Azure Landing Zone",
      "months": "1-2",
      "color": "#4A9FE0",
      "workloads": [],
      "tasks": [
        "Deploy Azure Migrate appliance on VMware environment — Cloud Architect, 1 week — captures actual CPU/RAM/storage utilisation for right-sizing",
        "Validate compliance scope: confirm which workloads are in ${complianceReqs.join('/')} scope and document control matrix — Compliance lead, 1 week",
        "Configure Azure landing zone with ${networkArch} network topology and Microsoft Entra ID integration — Cloud Architect + Network lead, 2 weeks"
      ]
    },
    {
      "name": "Phase N — [descriptive name matching wave]",
      "months": "X-Y",
      "color": "#hex",
      "workloads": ["EXACT workload names from wave"],
      "tasks": [
        "Specific task referencing the actual workload name — role, duration, output",
        "e.g. Migrate PROD-SQL-01 (SQL Server 2019, 16 vCPU / 128 GB) to Azure SQL Managed Instance — DBA lead, 3 weeks — Output: production database running in Azure with Business Critical tier, <15 min RPO"
      ]
    }
  ],
  "consolidationOpportunities": [
    {
      "workloads": ["exact workload names that could consolidate"],
      "currentApproach": "Individual VM rehost — ${Math.ceil(wave1.length / 3)} separate VMs",
      "recommendedApproach": "Azure Files Premium share or Azure NetApp Files for high-performance workloads",
      "rationale": "Specific reason referencing actual workload names and expected performance requirements",
      "costImpact": "Estimated monthly saving vs individual VM rehost"
    }
  ],
  "repurchaseAlternatives": [
    {
      "workload": "exact workload name",
      "currentPath": "current 6R recommendation e.g. Replatform to AKS",
      "alternative": "SaaS alternative e.g. Atlassian Cloud",
      "tradeoffs": "SaaS = faster delivery, lower ops burden, less customisation. Self-hosted = full control, higher maintenance cost.",
      "recommendation": "Which Zones recommends and why, given this client context"
    }
  ],
  "risks": [
    {
      "risk": "Specific risk referencing actual workload names",
      "likelihood": "High|Medium|Low",
      "mitigation": "Specific mitigation steps with named tools and owners"
    }
  ],
  "drStrategy": {
    "rpoTarget": "e.g. 15 minutes for ${complianceReqs.includes('HIPAA') ? 'HIPAA-scoped' : 'critical'} workloads",
    "rtoTarget": "e.g. 4 hours for critical workloads, 24 hours for standard",
    "approach": "Specific DR approach referencing actual workload names and Azure services",
    "tooling": "Azure Site Recovery / Azure Backup / geo-redundant storage / availability zones"
  },
  "costEstimate": {
    "azureConsumption": {
      "monthly": "$X,XXX-$X,XXX/month",
      "annual": "$XX,XXX-$XX,XXX/year",
      "breakdown": "IaaS VMs: $X,XXX | PaaS services: $X,XXX | Storage: $XXX | Networking/egress: $XXX | Backup: $XXX"
    },
    "zonesServices": {
      "total": "$XX,XXX-$XX,XXX",
      "breakdown": "Discovery and assessment: $X,XXX | Migration execution: $XX,XXX | Testing and validation: $X,XXX | Hypercare support: $X,XXX"
    },
    "toolingAndLicenses": {
      "total": "$X,XXX-$X,XXX",
      "breakdown": "Azure Migrate: included | Azure Site Recovery: ~$25/VM/month | Compliance tooling: $X,XXX | Azure Monitor: $XXX"
    }
  },
  "clientQuestions": [
    "Specific question referencing a named workload — e.g. PROD-SQL-01 is running SQL Server 2019 Standard — do you have Software Assurance active? This determines whether Azure Hybrid Benefit applies and could reduce IaaS VM licensing cost by up to 40%.",
    "Specific question about a constraint or dependency — e.g. Three of the file server workloads are listed without application dependency information. Which applications write to these shares, and are any of them connected to manufacturing floor equipment or OT systems that cannot tolerate network disruption?",
    "Specific question about end-of-life risk — relevant if any workload has endOfLifeRisk=true",
    "Specific question about compliance scope — e.g. Which of the ${scored.length} workloads are in PCI-DSS/HIPAA scope? This affects whether they can share compute with non-compliant workloads in Azure.",
    "Specific question about timeline or budget — e.g. The ${timeline} timeline assumes Wave 1 begins within 60 days. Do you have an internal IT freeze window (e.g. Q4 for retail or fiscal year-end) that would block migration activity during that period?"
  ],
  "architectureDiagram": {
    "type": "mermaid",
    "title": "${clientName} — Target ${targetCloud} Architecture",
    "chart": "graph TD\\nonprem[On-Prem VMware]\\nlz[Azure Landing Zone]\\nonprem --> lz\\nlz --> iaas[Azure IaaS VMs]\\nlz --> sql[Azure SQL Managed Instance]\\nlz --> app[Azure App Service]\\nlz --> files[Azure Files / ANF]\\nlz --> entra[Microsoft Entra ID]"
  }
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  3000,
    })

    const raw = completion.choices[0].message.content
    console.log('blueprint finish_reason:', completion.choices[0].finish_reason)

    let result
    try {
      result = parseJson(raw)
    } catch (parseErr) {
      console.error('blueprint JSON parse failed:', parseErr.message)
      return res.status(500).json({ error: 'AI returned invalid JSON', detail: parseErr.message })
    }

    // Fix any Mermaid charts
    if (result.visuals) {
      result.visuals = result.visuals.map(v => {
        if (v.type === 'mermaid' && v.chart) v.chart = fixMermaidChart(v.chart)
        return v
      })
    }

    // Auto-save to Cosmos DB if clientId provided
    if (clientId) {
      try {
        const { resource: client } = await containers.clients.item(clientId, clientId).read()
        if (client) {
          if (!client.cloudModernization) client.cloudModernization = { sessions: [] }
          const session = {
            id:            `cm-${Date.now()}`,
            createdAt:     new Date().toISOString(),
            workloads,
            targetCloud,
            timeline,
            budgetRange,
            constraints,
            scoringResult,
            calcResult,
            blueprint:     result,
          }
          client.cloudModernization.sessions.unshift(session)
          if (client.cloudModernization.sessions.length > 10) {
            client.cloudModernization.sessions = client.cloudModernization.sessions.slice(0, 10)
          }
          client.cloudModernization.updatedAt = new Date().toISOString()
          client.updatedAt                    = new Date().toISOString()
          await containers.clients.item(clientId, clientId).replace(client)
          console.log('blueprint auto-saved for client', clientId)
        }
      } catch (saveErr) {
        console.error('blueprint auto-save failed (non-fatal):', saveErr.message)
      }
    }

    console.log('blueprint success')
    res.json(result)
  } catch (err) {
    console.error('blueprint error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
