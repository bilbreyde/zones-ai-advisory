import { Router } from 'express'
import { containers } from '../db.js'
import { fixMermaidChart } from '../utils/mermaid.js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat,
} from 'docx'

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

// ── Blueprint prompt builders ─────────────────────────────────────────────────

function buildWaveDetail(wls) {
  if (!wls || !wls.length) return 'None'
  return wls.map(w =>
    `  - ${w.name}: ${w.recommendation} → ${w.recommendedPath || w.recommendation}` +
    (w.endOfLifeRisk ? ' ⚠ END-OF-LIFE' : '') +
    (w.consolidationNote ? ` [${w.consolidationNote}]` : '') +
    `\n    Rationale: ${w.rationale || 'no rationale'}` +
    `\n    Effort: ${w.effort || '?'} · Risk: ${w.risk || '?'}` +
    (w.waveRationale ? `\n    Wave rationale: ${w.waveRationale}` : '')
  ).join('\n')
}

function buildRefinementPrompt(ctx) {
  const prevPhasesJson = ctx.previousBlueprint?.phases
    ? JSON.stringify(ctx.previousBlueprint.phases, null, 2)
    : 'Not provided'
  const prevSummary = ctx.previousBlueprint?.summary || 'Not provided'

  return `You are a senior cloud solutions architect at Zones. An advisor has answered clarifying questions about a client migration. Update the blueprint based on these answers.

Client: ${ctx.clientName}
Compliance: ${ctx.complianceReqs?.join(', ') || 'standard'}
Target cloud: ${ctx.targetCloud || 'Azure'}
Timeline: ${ctx.timeline || 'not specified'}

ADVISOR ANSWERS TO CLARIFYING QUESTIONS:
${ctx.advisorAnswers}

CURRENT BLUEPRINT PHASES (what you are updating — these are the assignments you must override when advisor answers contradict them):
${prevPhasesJson}

CURRENT BLUEPRINT SUMMARY:
${prevSummary}

ORIGINAL WORKLOAD SCORING (reference only — the advisor answers take precedence over this):
Wave 1 (quick wins):
${ctx.wave1Detail}

Wave 2 (core migration):
${ctx.wave2Detail}

Wave 3 (complex/critical):
${ctx.wave3Detail}

INSTRUCTIONS — this is a REFINEMENT, not a fresh blueprint:
1. Read each advisor answer carefully — they take precedence over the original workload scoring
2. The CURRENT BLUEPRINT PHASES above are your starting point, not the raw workload scoring
3. If an advisor answer contradicts a current phase assignment (e.g. a workload is listed as "Replatform to Azure SQL" but the advisor says it has OT serial port dependencies and cannot move to cloud) — you MUST move that workload to Retain and remove it from ALL migration phases
4. If an advisor answer clarifies a workload type (e.g. "BMS is a Building Management System, not a database") — correct its strategy, recommended path, and phase assignment accordingly
5. If an answer reveals a constraint (e.g. "we have a change freeze in Q4") — update the timeline
6. If an answer reveals a dependency (e.g. "File Servers 1-5 all feed the ERP") — update wave sequencing
7. If an answer reveals licensing info (e.g. "we have Software Assurance") — update cost estimates
8. Generate NEW questions ONLY if the answers revealed new unknowns — otherwise set clientQuestions to [] or at most 1-2 targeted follow-ups
9. The phases must reference workloads by EXACT names
10. Never say "Azure AD" — always say "Microsoft Entra ID"
11. Cost estimates must break down into: Azure consumption / Zones services / tooling
12. The answersApplied array must contain one entry per advisor answer formatted as: "[Workload name]: [what changed] — e.g. BMS: moved from Wave 2 Replatform to Retain — OT serial port dependencies prevent cloud migration". If nothing changed for a particular answer, explain why.

Return ONLY raw JSON:
{
  "summary": "Updated 3-4 sentence executive summary reflecting the advisor answers",
  "phases": [
    {
      "name": "Phase name",
      "months": "X-Y",
      "color": "#4A9FE0",
      "workloads": ["exact workload names"],
      "tasks": ["specific task with owner and output"]
    }
  ],
  "consolidationOpportunities": [],
  "repurchaseAlternatives": [],
  "risks": [
    {
      "risk": "specific risk",
      "likelihood": "High|Medium|Low",
      "mitigation": "specific mitigation"
    }
  ],
  "drStrategy": {
    "rpoTarget": "string",
    "rtoTarget": "string",
    "approach": "string",
    "tooling": "string"
  },
  "costEstimate": {
    "azureConsumption": { "monthly": "string", "annual": "string", "breakdown": "string" },
    "zonesServices": { "total": "string", "breakdown": "string" },
    "toolingAndLicenses": { "total": "string", "breakdown": "string" }
  },
  "clientQuestions": [],
  "architectureDiagram": {
    "type": "mermaid",
    "title": "${ctx.clientName} — Target Cloud Architecture",
    "chart": "graph TD\\n  onPrem[\\"On-Premises\\"] --> hubSpoke[\\"Hub-Spoke Network\\"]\\n  hubSpoke --> azureIaas[\\"Azure IaaS\\"]\\n  hubSpoke --> azureSql[\\"Azure SQL MI\\"]"
  },
  "answersApplied": [
    "[Workload name]: [what changed and why] — e.g. BMS: moved from Wave 2 Replatform to Retain — OT serial port dependencies prevent cloud migration"
  ]
}`
}

function buildInitialPrompt(ctx) {
  return `You are a senior cloud solutions architect at Zones generating a detailed migration blueprint for a client engagement.

Client: ${ctx.clientName}
Target cloud: ${ctx.targetCloud || 'Azure'}
Timeline: ${ctx.timeline || '12 months'}
Budget: ${ctx.budgetRange || 'not specified'}
Network architecture: ${ctx.networkArch || 'Hub-Spoke'}
High availability required: ${ctx.haRequirement}
Disaster recovery required: ${ctx.drRequirement}
Prefer managed services (PaaS): ${ctx.managedServices}
Compliance: ${ctx.complianceReqs?.length ? ctx.complianceReqs.join(', ') : 'standard'}
Constraints: ${ctx.constraints || 'none'}
Additional requirements: ${ctx.additionalReqs || 'none'}

WORKLOAD SUMMARY: ${ctx.scored.length} workloads total
Distribution: ${ctx.distStr || 'not scored'}
End-of-life workloads: ${ctx.eolWorkloads.map(w => w.name).join(', ') || 'none'}

SCORED WORKLOADS BY WAVE — reference by EXACT NAME in all phases:

Wave 1 (Quick wins — low risk, fast value):
${ctx.wave1Detail}

Wave 2 (Core migration):
${ctx.wave2Detail}

Wave 3 (Complex, critical, or modernization):
${ctx.wave3Detail}

CONSOLIDATION OPPORTUNITIES (from scoring):
${ctx.consolidation.join('\n') || 'None identified'}

REPURCHASE ALTERNATIVES (from scoring):
${ctx.repurchase.join('\n') || 'None identified'}

CRITICAL RULES — follow every one:
1. Reference workloads by EXACT names from the inventory — never generic names like "File Server 1" or "VM-001"
2. For each task: include the specific workload name, the responsible role, the duration, and the output/deliverable
3. End-of-life workloads (${ctx.eolWorkloads.map(w => w.name).join(', ') || 'none'}) must be called out explicitly as security risks with upgrade path
4. Never say "Azure AD" — always say "Microsoft Entra ID"
5. Never say "Azure Active Directory" — always say "Microsoft Entra ID"
6. Cost estimates must break down into three categories: Azure consumption / Zones professional services / tooling and licenses
7. Include RPO/RTO targets for any ${ctx.complianceReqs?.length ? ctx.complianceReqs.join('/') : 'compliance-scoped'} workloads
8. For each consolidation opportunity, show the cost delta vs individual migration
9. The "Questions for the client" section must reference specific workload names and constraints
10. The architecture diagram must reference actual Azure services chosen for the specific workloads — not generic boxes
11. Generate 4-6 specific questions the advisor must answer before finalizing the SOW

Return ONLY raw JSON:
{
  "summary": "3-4 sentence executive summary naming specific workloads and the primary modernization strategy for ${ctx.clientName}",
  "phases": [
    {
      "name": "Phase 1 — Discovery and Azure Landing Zone",
      "months": "1-2",
      "color": "#4A9FE0",
      "workloads": [],
      "tasks": [
        "Deploy Azure Migrate appliance on VMware environment — Cloud Architect, 1 week — captures actual CPU/RAM/storage utilisation for right-sizing",
        "Configure Azure landing zone with ${ctx.networkArch || 'Hub-Spoke'} network topology and Microsoft Entra ID integration — Cloud Architect + Network lead, 2 weeks"
      ]
    }
  ],
  "consolidationOpportunities": [
    {
      "workloads": ["exact workload names that could consolidate"],
      "currentApproach": "Individual VM rehost",
      "recommendedApproach": "Azure Files Premium share or Azure NetApp Files",
      "rationale": "Specific reason referencing actual workload names",
      "costImpact": "Estimated monthly saving vs individual VM rehost"
    }
  ],
  "repurchaseAlternatives": [
    {
      "workload": "exact workload name",
      "currentPath": "current 6R recommendation",
      "alternative": "SaaS alternative",
      "tradeoffs": "SaaS vs self-hosted tradeoffs",
      "recommendation": "Which Zones recommends and why"
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
    "rpoTarget": "e.g. 15 minutes for critical workloads",
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
      "breakdown": "Azure Migrate: included | Azure Site Recovery: ~$25/VM/month | Azure Monitor: $XXX"
    }
  },
  "clientQuestions": [
    "Specific question referencing a named workload — e.g. PROD-SQL-01: do you have Software Assurance active? Azure Hybrid Benefit could reduce licensing cost by up to 40%.",
    "Specific question about dependencies — e.g. which applications write to the file server workloads?",
    "Specific question about end-of-life risk — relevant if any workload has endOfLifeRisk=true",
    "Specific question about compliance scope — which workloads are in-scope?",
    "Specific question about timeline or budget constraints"
  ],
  "architectureDiagram": {
    "type": "mermaid",
    "title": "${ctx.clientName} — Target ${ctx.targetCloud || 'Azure'} Architecture",
    "chart": "graph TD\\n  onPrem[\\"On-Premises VMware\\"] --> landingZone[\\"Azure Landing Zone\\"]\\n  landingZone --> azureIaas[\\"Azure IaaS VMs\\"]\\n  landingZone --> azureSql[\\"Azure SQL MI\\"]\\n  landingZone --> azureFiles[\\"Azure Files\\"]\\n  landingZone --> entraId[\\"Microsoft Entra ID\\"]"
  }
}

CRITICAL RULES FOR architectureDiagram.chart — MUST FOLLOW:
- Node IDs MUST be camelCase with NO hyphens. WRONG: hub-spoke, microsoft-entra-id. CORRECT: hubSpoke, microsoftEntraId
- DO NOT use subgraph blocks. They break the renderer. Use only flat node definitions and --> edges.
- Max 10 nodes. Every node MUST have a quoted label: nodeId["Human Readable Label"]
- Only use --> for edges. No other arrow styles.
- Valid example: graph TD\\n  onPrem["On-Premises"] --> hubSpoke["Hub-Spoke Network"]\\n  hubSpoke --> azureIaas["Azure IaaS"]\\n  hubSpoke --> azureSql["Azure SQL MI"]`
}

// ── POST /blueprint ───────────────────────────────────────────────────────────
router.post('/blueprint', async (req, res) => {
  try {
    // Accept both old field names (from generateBlueprint) and new ones (from refine)
    const {
      // New-style fields (from refineBlueprintWithAnswers)
      scoredWorkloads,
      // Old-style fields (from generateBlueprint — scoringResult.workloads)
      scoringResult,
      workloads      = [],
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
      previousBlueprint,
      clientId,
    } = req.body

    // Resolve scored workload array from either field
    const scored = scoredWorkloads || scoringResult?.workloads || []

    const isRefinement = !!(advisorAnswers && advisorAnswers.trim())
    console.log('Blueprint mode:', isRefinement ? 'REFINEMENT' : 'INITIAL', '| workloads:', scored.length)
    if (isRefinement) {
      console.log('Advisor answers:', advisorAnswers.slice(0, 300))
      console.log('previousBlueprint received:', !!(previousBlueprint?.phases?.length))
    }

    // Get client name
    let clientName = 'Client'
    if (clientId) {
      try {
        const { resource } = await containers.clients.item(clientId, clientId).read()
        if (resource?.name) clientName = resource.name
      } catch (_) {}
    }

    // Wave grouping with fallback distribution
    let wave1 = scored.filter(w => w.wave === 1).slice(0, 8)
    let wave2  = scored.filter(w => w.wave === 2).slice(0, 8)
    let wave3  = scored.filter(w => w.wave === 3).slice(0, 8)
    if (!wave1.length && !wave2.length && !wave3.length && scored.length > 0) {
      const chunk = Math.ceil(scored.length / 3)
      wave1 = scored.slice(0, chunk)
      wave2 = scored.slice(chunk, chunk * 2)
      wave3 = scored.slice(chunk * 2)
    }

    const wave1Detail = buildWaveDetail(wave1)
    const wave2Detail = buildWaveDetail(wave2)
    const wave3Detail = buildWaveDetail(wave3)

    const rDist = scored.reduce((acc, w) => {
      acc[w.recommendation] = (acc[w.recommendation] || 0) + 1; return acc
    }, {})
    const distStr      = Object.entries(rDist).map(([r, n]) => `${r}: ${n}`).join(' | ')
    const eolWorkloads = scored.filter(w => w.endOfLifeRisk)
    const consolidation = scored.filter(w => w.consolidationNote).map(w => `${w.name}: ${w.consolidationNote}`)
    const repurchase    = scored.filter(w => w.repurchaseAlternative).map(w => `${w.name} → ${w.repurchaseAlternative}`)

    const ctx = {
      clientName, targetCloud, timeline, budgetRange, constraints,
      complianceReqs, haRequirement, drRequirement, managedServices,
      networkArch, additionalReqs, advisorAnswers, previousBlueprint,
      scored, distStr, eolWorkloads, consolidation, repurchase,
      wave1, wave2, wave3, wave1Detail, wave2Detail, wave3Detail,
    }

    const prompt = isRefinement ? buildRefinementPrompt(ctx) : buildInitialPrompt(ctx)

    const aiClient = await getAiClient()
    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: isRefinement ? 0.2 : 0.3,
      max_tokens:  4000,
    })
    console.log('Blueprint finish_reason:', completion.choices[0].finish_reason)

    const raw = completion.choices[0].message.content
    let result
    try {
      result = parseJson(raw)
    } catch (parseErr) {
      // Recovery — walk character-by-character to find balanced JSON object
      const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const start = clean.indexOf('{')
      if (start === -1) return res.status(500).json({ error: 'No JSON in AI response' })
      let depth = 0, end = -1
      for (let i = start; i < clean.length; i++) {
        if (clean[i] === '{') depth++
        if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end === -1) return res.status(500).json({ error: 'Unbalanced JSON from AI', raw: raw.slice(0, 500) })
      try { result = JSON.parse(clean.slice(start, end + 1)) }
      catch { return res.status(500).json({ error: 'JSON parse failed after recovery', raw: raw.slice(0, 500) }) }
    }

    // Fix Mermaid chart if present
    if (result.architectureDiagram?.chart) {
      result.architectureDiagram.chart = fixMermaidChart(result.architectureDiagram.chart)
    }

    // Auto-save to Cosmos DB
    if (clientId) {
      try {
        const { resource: clientDoc } = await containers.clients.item(clientId, clientId).read()
        if (clientDoc) {
          if (!clientDoc.cloudModernization) clientDoc.cloudModernization = { sessions: [] }
          const session = {
            id: `cm-${Date.now()}`, createdAt: new Date().toISOString(),
            workloads, targetCloud, timeline, budgetRange, constraints,
            scoringResult: scoringResult || { workloads: scored },
            calcResult, blueprint: result,
          }
          clientDoc.cloudModernization.sessions.unshift(session)
          if (clientDoc.cloudModernization.sessions.length > 10)
            clientDoc.cloudModernization.sessions = clientDoc.cloudModernization.sessions.slice(0, 10)
          clientDoc.cloudModernization.updatedAt = new Date().toISOString()
          clientDoc.updatedAt = new Date().toISOString()
          await containers.clients.item(clientId, clientId).replace(clientDoc)
          console.log('Blueprint auto-saved for client', clientId)
        }
      } catch (saveErr) {
        console.error('Blueprint auto-save failed (non-fatal):', saveErr.message)
      }
    }

    console.log('Blueprint success, answersApplied:', result.answersApplied?.length ?? 0)
    res.json(result)
  } catch (err) {
    console.error('Blueprint error:', err.message, err.stack?.split('\n')[1])
    res.status(500).json({ error: err.message })
  }
})

// ── POST /sow — Generate Statement of Work .docx ────────────────────────────
router.post('/sow', async (req, res) => {
  try {
    const {
      clientName = 'Client',
      vertical = '',
      compliance = [],
      requirements = {},
      blueprint = {},
      advisorName = '',
      advisorTitle = '',
      advisorEmail = '',
      advisorPhone = '',
    } = req.body

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const targetCloud = requirements.targetCloud || blueprint.targetCloud || 'Azure'
    const timeline    = requirements.timeline    || blueprint.timeline    || '12 months'
    const budget      = requirements.budget      || 'TBD'

    const ce      = blueprint.costEstimate || {}
    const azure   = ce.azureConsumption  || ce.azure   || {}
    const zones   = ce.zonesServices     || ce.zones   || {}
    const tooling = ce.toolingAndLicenses|| ce.tooling || {}
    const phases  = blueprint.phases || []
    const risks   = blueprint.risks  || []

    const NAVY    = '0D1B3E'
    const BLUE    = '2962FF'
    const GRAY    = 'F5F6FA'
    const BDR     = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
    const borders = { top: BDR, bottom: BDR, left: BDR, right: BDR }
    const cm      = { top: 100, bottom: 100, left: 150, right: 150 }

    function h1(text) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text, bold: true, size: 28, color: NAVY, font: 'Arial' })],
        spacing: { before: 320, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 } },
      })
    }
    function h2(text) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, size: 24, color: NAVY, font: 'Arial' })],
        spacing: { before: 240, after: 120 },
      })
    }
    function body(text, options = {}) {
      return new Paragraph({
        children: [new TextRun({ text: text || '', size: 22, font: 'Arial', ...options })],
        spacing: { before: 80, after: 80 },
      })
    }
    function bullet(text) {
      return new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: text || '', size: 22, font: 'Arial' })],
        spacing: { before: 60, after: 60 },
      })
    }
    function spacer() {
      return new Paragraph({ children: [new TextRun('')], spacing: { before: 80, after: 80 } })
    }
    function twoColTable(rows) {
      return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: rows.map(([label, value]) => new TableRow({
          children: [
            new TableCell({
              borders, width: { size: 3000, type: WidthType.DXA }, margins: cm,
              shading: { fill: 'EEF1FA', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 21, font: 'Arial', color: NAVY })] })],
            }),
            new TableCell({
              borders, width: { size: 6360, type: WidthType.DXA }, margins: cm,
              children: [new Paragraph({ children: [new TextRun({ text: value || 'TBD', size: 21, font: 'Arial' })] })],
            }),
          ],
        })),
      })
    }
    function hdrCell(text, w) {
      return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cm,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 21, font: 'Arial', color: 'FFFFFF' })] })],
      })
    }
    function dataCell(text, w, shade) {
      return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cm,
        shading: { fill: shade, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 21, font: 'Arial' })] })],
      })
    }

    const phaseTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3500, 1800, 4060],
      rows: [
        new TableRow({ children: [hdrCell('Phase', 3500), hdrCell('Timeline', 1800), hdrCell('Workloads', 4060)] }),
        ...phases.map((p, i) => {
          const shade = i % 2 === 0 ? GRAY : 'FFFFFF'
          return new TableRow({ children: [
            dataCell(p.name || '', 3500, shade),
            dataCell(`Months ${p.months || ''}`, 1800, shade),
            dataCell((p.workloads || []).join(', '), 4060, shade),
          ]})
        }),
      ],
    })

    const scheduleTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3500, 1800, 4060],
      rows: [
        new TableRow({ children: [hdrCell('Milestone', 3500), hdrCell('Timeline', 1800), hdrCell('Owner', 4060)] }),
        ...phases.map((p, i) => {
          const shade = i % 2 === 0 ? GRAY : 'FFFFFF'
          return new TableRow({ children: [
            dataCell(p.name || '', 3500, shade),
            dataCell(`Months ${p.months || ''}`, 1800, shade),
            dataCell('Zones Migration Team', 4060, shade),
          ]})
        }),
        new TableRow({ children: [
          dataCell('Project Completion & Sign-off', 3500, 'EEF1FA'),
          dataCell(timeline, 1800, 'EEF1FA'),
          dataCell('Zones PM + Client Lead', 4060, 'EEF1FA'),
        ]}),
      ],
    })

    const riskTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 1560, 3120],
      rows: [
        new TableRow({ children: [hdrCell('Risk', 4680), hdrCell('Likelihood', 1560), hdrCell('Mitigation', 3120)] }),
        ...risks.map((r, i) => {
          const shade = i % 2 === 0 ? GRAY : 'FFFFFF'
          const lhColor = r.likelihood === 'High' ? 'C8503C' : r.likelihood === 'Medium' ? 'C88C14' : '22A064'
          return new TableRow({ children: [
            dataCell(r.risk || '', 4680, shade),
            new TableCell({
              borders, width: { size: 1560, type: WidthType.DXA }, margins: cm,
              shading: { fill: shade, type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: r.likelihood || '', size: 21, font: 'Arial', bold: true, color: lhColor })] })],
            }),
            dataCell(r.mitigation || '', 3120, shade),
          ]})
        }),
      ],
    })

    const phaseTaskSections = phases.flatMap(phase => {
      const tasks = (phase.tasks || []).map(t =>
        typeof t === 'string' ? t
          : t?.task ? `${t.task}${t.owner ? ` (${t.owner})` : ''}${t.output ? ` \u2014 ${t.output}` : ''}`
          : JSON.stringify(t)
      )
      return [
        h2(phase.name || ''),
        body(`Timeline: Months ${phase.months || 'TBD'}`, { color: '666666' }),
        ...tasks.map(t => bullet(t)),
        spacer(),
      ]
    })

    const doc = new Document({
      numbering: {
        config: [{
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        }],
      },
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new TextRun({ text: 'ZONES, LLC  |  STATEMENT OF WORK  |  CONFIDENTIAL', size: 16, font: 'Arial', color: '888888' })],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 1 } },
              alignment: AlignmentType.RIGHT,
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [
                new TextRun({ text: `${clientName} Cloud Modernization SOW  |  `, size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ text: ' of ', size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '888888' }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 1 } },
            })],
          }),
        },
        children: [
          // ── COVER ──────────────────────────────────────────────────────────────
          spacer(), spacer(),
          new Paragraph({
            children: [new TextRun({ text: 'STATEMENT OF WORK', size: 52, bold: true, font: 'Arial', color: NAVY })],
            alignment: AlignmentType.CENTER, spacing: { before: 480, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Cloud Modernization Services', size: 36, font: 'Arial', color: BLUE })],
            alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Prepared for: ${clientName}`, size: 26, font: 'Arial', color: '444444' })],
            alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Target Platform: ${targetCloud}`, size: 22, font: 'Arial', color: '666666' })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: today, size: 22, font: 'Arial', color: '666666' })],
            alignment: AlignmentType.CENTER, spacing: { before: 40, after: 480 },
          }),
          spacer(), spacer(),
          twoColTable([
            ['Submitted to:', clientName],
            ['Industry / Vertical:', vertical || 'Technology'],
            ['Compliance Requirements:', compliance.length ? compliance.join(', ') : 'Standard'],
            ['Target Cloud:', targetCloud],
            ['Estimated Timeline:', timeline],
            ['Estimated Budget:', budget],
            ['Total Services Fee:', zones.total || 'TBD'],
            ['Submitted by:', 'Zones, LLC'],
            ['Account Executive:', advisorName || '[ATE Name]'],
            ['AE Title:', advisorTitle || '[ATE Title]'],
            ['AE Email:', advisorEmail || '[ATE Email]'],
            ['AE Phone:', advisorPhone || '[ATE Phone]'],
            ['Date:', today],
          ]),
          spacer(),
          new Paragraph({
            children: [new TextRun({
              text: 'Copyright \u00A9 2024 by Zones, LLC. This Statement of Work contains proprietary and confidential information of Zones, LLC and is disclosed solely to the authorized recipient for evaluation purposes.',
              size: 16, font: 'Arial', color: '888888', italics: true,
            })],
            spacing: { before: 160, after: 80 },
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 1. EXECUTIVE SUMMARY ────────────────────────────────────────────────
          h1('1. Executive Summary'),
          h2('1.1. Technology Challenge'),
          body(`${clientName} is undertaking a cloud modernization initiative to migrate workloads to ${targetCloud}${compliance.length ? `, while maintaining compliance with ${compliance.join(', ')}` : ''}. The current on-premises infrastructure presents challenges including scalability limitations, rising operational costs, and aging hardware requiring modernization to support future business growth.`),
          spacer(),
          h2(`1.2. The Solution for ${clientName}`),
          body(blueprint.summary || `Zones will deliver a structured cloud migration engagement, migrating workloads to ${targetCloud} using a phased approach over ${timeline}.`),
          spacer(),
          ...(blueprint.answersApplied?.length ? [
            h2('1.3. Advisor Clarifications Applied'),
            ...blueprint.answersApplied.map(note => bullet(String(note))),
            spacer(),
          ] : []),
          h2('1.3. Next Steps'),
          bullet('Review and execute this Statement of Work'),
          bullet('Zones schedules kick-off meeting with client stakeholders'),
          bullet('Project team established and project plan delivered within 5 business days of SOW execution'),
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 2. SOLUTION PRICING SUMMARY ─────────────────────────────────────────
          h1('2. Solution Pricing Summary'),
          spacer(),
          twoColTable([
            ['Azure Consumption (Monthly)', azure.monthly || 'TBD'],
            ['Azure Consumption (Annual)',  azure.annual  || 'TBD'],
            ['Azure Cost Breakdown',        azure.breakdown || 'TBD'],
            ['Zones Professional Services', zones.total || 'TBD'],
            ['Services Breakdown',          zones.breakdown || 'TBD'],
            ['Tooling & Licenses',          tooling.total || 'TBD'],
            ['Tooling Breakdown',           tooling.breakdown || 'TBD'],
          ]),
          spacer(),
          ...(blueprint.drStrategy ? [
            h2('2.1. DR & Resilience'),
            twoColTable([
              ['RPO Target', blueprint.drStrategy.rpoTarget || blueprint.drStrategy.rpo || 'TBD'],
              ['RTO Target', blueprint.drStrategy.rtoTarget || blueprint.drStrategy.rto || 'TBD'],
              ['Approach',   blueprint.drStrategy.approach  || 'TBD'],
              ['Tooling',    typeof blueprint.drStrategy.tooling === 'string' ? blueprint.drStrategy.tooling : (Array.isArray(blueprint.drStrategy.tooling) ? blueprint.drStrategy.tooling.join(', ') : 'TBD')],
            ]),
            spacer(),
          ] : []),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 3. SERVICES PROPOSAL ────────────────────────────────────────────────
          h1('3. Services Proposal'),
          h2('3.1. Overview'),
          body(`Zones will perform a structured cloud migration for ${clientName} targeting ${targetCloud}. The engagement encompasses discovery, landing zone deployment, phased workload migration, testing, and hypercare support.`),
          spacer(),
          h2('3.2. Scope'),
          h2('3.2.1. Project Management'),
          bullet('Serve as primary Zones contact and liaison to client personnel'),
          bullet('Review SOW, project goals, and contractual responsibilities with client'),
          bullet('Maintain project communications and facilitate scheduling'),
          bullet('Prepare project implementation plan defining tasks, milestones, and schedule'),
          bullet('Provide status reporting and regular executive project status overviews'),
          bullet('Perform change and issue management throughout engagement'),
          bullet('Obtain client written acceptance of all deliverables'),
          spacer(),
          h2('3.2.2. Migration Phases'),
          phaseTable,
          spacer(),
          ...phaseTaskSections,
          h2('3.3. Out of Scope'),
          bullet('Physical hardware procurement or decommissioning unless explicitly listed'),
          bullet('Application code changes or refactoring beyond agreed replatforming tasks'),
          bullet('End-user training unless included as a line item'),
          bullet('Third-party vendor coordination beyond workloads listed in scope'),
          bullet('Ongoing managed services post-hypercare (available separately)'),
          spacer(),
          h2('3.4. Customer Responsibilities'),
          bullet(`${clientName} to provide access to all source systems, credentials, and network connectivity required for migration`),
          bullet('Designate a primary contact with decision-making authority'),
          bullet('Provide timely review and approval of deliverables (5 business days unless otherwise agreed)'),
          bullet('Ensure availability of key stakeholders for kick-off, checkpoint, and sign-off meetings'),
          bullet('Perform user acceptance testing within agreed timeframes'),
          spacer(),
          h2('3.5. Project Assumptions'),
          bullet(`Target cloud platform is ${targetCloud}`),
          bullet(`Total engagement timeline is approximately ${timeline}`),
          bullet('Client will procure required Azure subscriptions and licensing'),
          bullet('All source workloads are accessible and network-reachable during migration windows'),
          bullet('Client change management and approval processes will not extend migration windows beyond agreed schedule'),
          ...(compliance.length ? [bullet(`${compliance.join(', ')} compliance controls will be validated by client compliance team`)] : []),
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 4. RISK REGISTER ────────────────────────────────────────────────────
          h1('4. Risk Register'),
          spacer(),
          riskTable,
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 5. PROJECT SCHEDULE ─────────────────────────────────────────────────
          h1('5. Project Schedule'),
          body(`The project is estimated at ${timeline}. The schedule below reflects the phased migration approach. Final dates will be confirmed at project kick-off.`),
          spacer(),
          scheduleTable,
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 6. CONTACTS ─────────────────────────────────────────────────────────
          h1('6. Contacts'),
          spacer(),
          twoColTable([
            ['Zones Account Executive', advisorName || '[ATE Name]'],
            ['Title',   advisorTitle || '[ATE Title]'],
            ['Email',   advisorEmail || '[ATE Email]'],
            ['Phone',   advisorPhone || '[ATE Phone]'],
            ['Address', '1102 15th Street SW, Suite 102, Auburn, WA 98001-6509'],
          ]),
          spacer(),
          twoColTable([
            ['Client Primary Contact', '[Contact Name]'],
            ['Title',   '[Contact Title]'],
            ['Email',   '[Contact Email]'],
            ['Phone',   '[Contact Phone]'],
            ['Company', clientName],
          ]),
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 7. COMPLETION CRITERIA ──────────────────────────────────────────────
          h1('7. Completion Criteria'),
          body('This engagement will be considered complete when the following criteria are met:'),
          bullet('All in-scope workloads have been migrated, validated, and are operational in the target cloud environment'),
          bullet('Client has performed and signed off on user acceptance testing for all migrated workloads'),
          bullet('DR strategy has been implemented and tested per agreed RPO/RTO targets'),
          ...(compliance.length ? [bullet(`All ${compliance.join(', ')} compliance controls have been validated and documented`)] : []),
          bullet('All project documentation and runbooks have been delivered to client'),
          bullet('Hypercare period has concluded with no critical open issues'),
          bullet('Client has signed the project completion acknowledgement'),
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── 8. ZONES OVERVIEW ───────────────────────────────────────────────────
          h1('8. Zones Overview'),
          h2('8.1. Our Value Proposition'),
          body('Zones is an IT solutions provider with deep expertise in cloud migration, infrastructure modernization, and managed services. With over 30 years of experience, Zones serves enterprise clients across healthcare, financial services, manufacturing, and technology sectors.'),
          spacer(),
          h2('8.2. Why Zones for Cloud Modernization'),
          bullet('Certified Microsoft Azure Partner with proven migration methodology'),
          bullet('Dedicated cloud practice with specialized architects and migration engineers'),
          bullet('Track record of successful enterprise migrations with minimal business disruption'),
          bullet('End-to-end capability from assessment through ongoing managed services'),
          bullet('Zones Compass AI-powered advisory platform for data-driven migration planning'),
          spacer(),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SIGNATURE PAGE ──────────────────────────────────────────────────────
          h1('Signature Page'),
          body('By signing below, the parties agree to the terms and conditions set forth in this Statement of Work.'),
          spacer(), spacer(),
          twoColTable([
            ['Client Company',       clientName],
            ['Authorized Signature', ''],
            ['Printed Name',         ''],
            ['Title',                ''],
            ['Date',                 ''],
          ]),
          spacer(), spacer(),
          twoColTable([
            ['Zones, LLC',           ''],
            ['Authorized Signature', ''],
            ['Printed Name',         advisorName || ''],
            ['Title',                advisorTitle || ''],
            ['Date',                 today],
          ]),
        ],
      }],
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = `${clientName.replace(/\s+/g, '-')}-Cloud-Modernization-SOW-${new Date().toISOString().split('T')[0]}.docx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)

  } catch (err) {
    console.error('SOW generation error:', err.message, err.stack)
    res.status(500).json({ error: err.message })
  }
})

export default router
