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

    const prompt = `You are a cloud modernization architect applying the 6R framework to score workloads for migration to ${targetCloud}.

WORKLOADS:
${workloadLines}

REQUIREMENTS:
- Compliance: ${complianceReqs.length ? complianceReqs.join(', ') : 'standard'}
- High Availability required: ${haRequirement}
- Disaster Recovery required: ${drRequirement}
- Constraints: ${constraints || 'none'}

6R DEFINITIONS:
- Rehost: lift-and-shift to ${targetCloud} IaaS. Minimal changes. Fast.
- Replatform: containerize (AKS/ECS) or move to managed OS — no code changes
- Refactor: re-architect to PaaS (App Service, Functions, managed SQL, Cosmos DB)
- Repurchase: replace with SaaS equivalent
- Retire: decommission — not needed
- Retain: keep on-premises (compliance-blocked, too risky, or not cloud-ready)

RULES:
- Critical + cannot be changed → Retain or Rehost
- VMware workload → Rehost default, consider AVS as stepping stone
- Web apps/APIs → strong Refactor candidate
- Databases → Replatform to managed SQL or Refactor to PaaS
- SAP/Oracle ERP → Rehost only
- Sovereign data residency → Retain or on-prem only

Return ONLY raw JSON:
{
  "workloads": [
    {
      "name": "string",
      "recommendation": "Rehost|Replatform|Refactor|Repurchase|Retire|Retain",
      "rationale": "1-2 sentences specific to this workload",
      "effort": "Low|Medium|High",
      "risk": "Low|Medium|High"
    }
  ],
  "summary": "2-3 sentences on the overall migration approach"
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens:  3000,
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

    const scored = scoringResult?.workloads || []
    const byR    = scored.reduce((acc, w) => {
      const r = w.recommendation || 'Unknown'
      acc[r] = (acc[r] || [])
      acc[r].push(w.name)
      return acc
    }, {})

    const dist = Object.entries(byR).map(([r, names]) => `${r}: ${names.length}`).join(', ')

    const prompt = `You are a cloud modernization architect at Zones generating a migration blueprint.

Client: ${clientName}
Target cloud: ${targetCloud}
Timeline: ${timeline}
Budget: ${budgetRange || 'not specified'}
Network architecture: ${networkArch}
High availability: ${haRequirement}
Disaster recovery: ${drRequirement}
Prefer managed services: ${managedServices}
Compliance: ${complianceReqs.length ? complianceReqs.join(', ') : 'standard'}
Constraints: ${constraints || 'none'}
Additional requirements: ${additionalReqs || 'none'}

6R DISTRIBUTION: ${dist || 'not yet scored'}
WORKLOADS: ${workloads.filter(w => w.name).map(w => w.name).join(', ') || 'none'}

Generate a practical migration blueprint. Return ONLY raw JSON:
{
  "summary": "2-3 sentence executive summary of the migration strategy",
  "phases": [
    {
      "name": "string",
      "timeline": "e.g. Months 1-3",
      "workloads": ["workload name 1", "workload name 2"],
      "actions": ["action 1", "action 2", "action 3"]
    }
  ],
  "risks": [
    { "risk": "risk title", "mitigation": "mitigation approach" }
  ],
  "architectureNotes": "2-3 sentences on key architectural decisions",
  "estimatedCost": "cost range and breakdown narrative",
  "visuals": [
    {
      "type": "mermaid",
      "title": "${clientName} — Target Architecture",
      "chart": "graph TD\\nA[On-Prem VMware] --> B[Azure Landing Zone]\\nB --> C[Azure IaaS]\\nB --> D[Azure App Service]\\nB --> E[Azure SQL]"
    }
  ]
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
