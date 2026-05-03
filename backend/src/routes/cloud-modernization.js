import { Router } from 'express'
import { containers } from '../db.js'
import { fixMermaidChart } from '../utils/mermaid.js'

const router = Router()

// GET /api/clients/:id/cloud-modernization
router.get('/clients/:id/cloud-modernization', async (req, res) => {
  try {
    const { resource } = await containers.clients
      .item(req.params.id, req.params.id).read()
    const cm = resource?.cloudModernization
    if (!cm?.sessions?.length) return res.json({ hasResults: false })
    res.json({
      hasResults:   true,
      session:      cm.sessions[0],
      sessionCount: cm.sessions.length,
      lastUpdated:  cm.updatedAt,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clients/:id/cloud-modernization
router.post('/clients/:id/cloud-modernization', async (req, res) => {
  try {
    const { resource: client } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!client.cloudModernization) client.cloudModernization = { sessions: [] }

    const session = {
      id:        `cm-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body.session,
    }

    client.cloudModernization.sessions.unshift(session)
    client.cloudModernization.updatedAt = new Date().toISOString()
    client.updatedAt                    = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(client)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cloud-modernization/parse-csv — parse workload CSV
router.post('/parse-csv', async (req, res) => {
  try {
    const { csvContent, clientName } = req.body
    if (!csvContent) return res.status(400).json({ error: 'csvContent required' })

    const { AzureOpenAI } = await import('openai')
    const aiClient = new AzureOpenAI({
      endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
      apiKey:     process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-08-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    })

    const prompt = `Parse this infrastructure inventory CSV and extract workload information.

CSV content:
${csvContent.slice(0, 4000)}

Map columns to this workload model. Be tolerant of column name variations:
- name: VM name, server name, workload name, hostname
- type: OS type → map to "Windows VM" / "Linux VM" / "Web App" / "Database" / "Container" / "Other"
- platform: current platform → map to "VMware vSphere" / "Hyper-V" / "Bare metal" / "Azure" / "AWS" / "Other"
- vcpu: vCPU count, CPU count, cores
- ramGb: RAM GB, memory GB, RAM
- storageGb: storage GB, disk GB, total storage
- os: operating system, OS version
- powerState: power state, status → "On" / "Off" / "Unknown"
- appStack: application, workload type, role (best guess from name/OS)

Return ONLY raw JSON:
{
  "workloads": [
    {
      "id": "w-1",
      "name": "string",
      "type": "Windows VM|Linux VM|Web App|Database|Container|Other",
      "platform": "VMware vSphere|Hyper-V|Bare metal|Azure|AWS|Other",
      "vcpu": number,
      "ramGb": number,
      "storageGb": number,
      "os": "string",
      "powerState": "On|Off|Unknown",
      "appStack": "string",
      "criticality": "Unknown",
      "changeSensitivity": "Unknown",
      "dependencies": [],
      "dataResidency": "Flexible",
      "imported": true,
      "needsReview": true
    }
  ],
  "unmappedColumns": ["column names that could not be mapped"],
  "totalRows": number,
  "parsedRows": number
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens:  4000,
    })

    const raw   = completion.choices[0].message.content
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cloud-modernization/score-workloads — 6R scoring
router.post('/score-workloads', async (req, res) => {
  try {
    const { workloads, vmwareContext, clientName, vertical, compliance } = req.body

    const { AzureOpenAI } = await import('openai')
    const aiClient = new AzureOpenAI({
      endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
      apiKey:     process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-08-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    })

    const prompt = `You are a cloud modernization architect at Zones applying the 6R framework to score workloads.

Client: ${clientName}
Industry: ${vertical || 'Unknown'}
Compliance: ${compliance?.join(', ') || 'standard'}
VMware context: ${JSON.stringify(vmwareContext || {})}

WORKLOADS TO SCORE:
${workloads.map((w, i) => `${i + 1}. ${w.name} — Type: ${w.type}, Platform: ${w.platform}, OS: ${w.os || 'Unknown'}, vCPU: ${w.vcpu || '?'}, RAM: ${w.ramGb || '?'}GB, Criticality: ${w.criticality}, Change sensitivity: ${w.changeSensitivity}, App stack: ${w.appStack || 'Unknown'}, Data residency: ${w.dataResidency}`).join('\n')}

6R DEFINITIONS FOR THIS CONTEXT:
- Rehost: lift and shift to Azure IaaS or Azure VMware Solution. Minimal app changes. Fast.
- Replatform: lift and optimize — containerize (AKS/Docker) or move to managed OS without code changes
- Refactor: re-architect to PaaS — Azure App Service, Azure Functions, Azure SQL, Cosmos DB
- Repurchase: replace with SaaS equivalent — move from custom app to commercial SaaS
- Retire: decommission — workload is not needed, can be shut down
- Retain: keep on-premises for now — too risky, compliance-constrained, or not yet ready

SCORING RULES:
- Mission critical + cannot be touched → Retain or Rehost only
- Windows Server 2008/2012 or .NET Framework < 4.0 → flag as end-of-life risk
- Already containerized → Replatform to AKS
- Web apps / APIs → strong Refactor candidate
- Databases → evaluate Replatform to managed SQL or Refactor to Azure SQL/Cosmos DB
- SAP / Oracle ERP → Rehost only (too complex to refactor)
- Legacy line-of-business apps → Rehost or Retain
- Simple web frontends → Refactor to Azure App Service or Static Web Apps
- If data residency = must stay on-prem → Retain or Nutanix (not Azure)

Return ONLY raw JSON:
{
  "scoredWorkloads": [
    {
      "id": "workload id",
      "name": "workload name",
      "recommendedR": "Rehost|Replatform|Refactor|Repurchase|Retire|Retain",
      "recommendedPath": "Specific path e.g. Azure VMware Solution|Azure IaaS|AKS containers|Azure App Service|Azure SQL|Retire|Keep on-prem",
      "migrationComplexity": 1,
      "modernizationPotential": 1,
      "businessRisk": 1,
      "rationale": "2 sentences specific to this workload",
      "endOfLifeRisk": false,
      "endOfLifeDetail": "e.g. Windows Server 2008 R2 — extended support ended Jan 2020",
      "estimatedEffortWeeks": 4,
      "wave": 1,
      "waveRationale": "Why this wave — dependencies, risk, quick win etc"
    }
  ],
  "summary": {
    "rehost": 0,
    "replatform": 0,
    "refactor": 0,
    "repurchase": 0,
    "retire": 0,
    "retain": 0,
    "endOfLifeCount": 0,
    "totalWorkloads": 0,
    "recommendedApproach": "2-3 sentence overall recommendation for this client"
  },
  "dependencyWarnings": [
    "Any dependency conflicts that affect wave sequencing"
  ]
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens:  4000,
    })

    const raw   = completion.choices[0].message.content
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cloud-modernization/vmware-calculator — licensing cost comparison
router.post('/vmware-calculator', async (req, res) => {
  try {
    const {
      vmCount,
      avgVcpu,
      avgRamGb,
      avgStorageGb,
      currentAnnualLicenseCost,
      licenseTier,
      contractRenewalMonths,
      targetCloud,
    } = req.body

    // AVS node sizing — each AV36P node: 36 cores, 576 GB RAM, 15.2 TB storage
    const AVS_NODE_PRICE_MONTHLY = 7200
    const AVS_NODE_VCPU          = 36
    const AVS_NODE_RAM           = 576
    const AVS_NODE_STORAGE_TB    = 15.2

    const totalVcpu      = vmCount * (avgVcpu    || 4)
    const totalRamGb     = vmCount * (avgRamGb   || 16)
    const totalStorageTb = (vmCount * (avgStorageGb || 500)) / 1024

    const nodesByVcpu    = Math.ceil(totalVcpu    / AVS_NODE_VCPU)
    const nodesByRam     = Math.ceil(totalRamGb   / AVS_NODE_RAM)
    const nodesByStorage = Math.ceil(totalStorageTb / AVS_NODE_STORAGE_TB)
    const avsNodes       = Math.max(nodesByVcpu, nodesByRam, nodesByStorage, 3)

    const avsMonthly = avsNodes * AVS_NODE_PRICE_MONTHLY
    const avsAnnual  = avsMonthly * 12

    const azureIaasMonthly = vmCount * 280
    const azureIaasAnnual  = azureIaasMonthly * 12

    const nutanixNodes   = Math.max(Math.ceil(vmCount / 20), 3)
    const nutanixMonthly = nutanixNodes * 2000
    const nutanixAnnual  = nutanixMonthly * 12

    let estimatedCurrentAnnual = currentAnnualLicenseCost
    if (!estimatedCurrentAnnual && vmCount) {
      const estimatedPreBroadcom = vmCount * 2 * 1200
      estimatedCurrentAnnual     = estimatedPreBroadcom * 3.5
    }

    const vmwareOpsCost   = estimatedCurrentAnnual * 0.25
    const avsTco3yr       = (avsAnnual       + vmwareOpsCost * 0.5) * 3
    const azureIaasTco3yr = (azureIaasAnnual + vmwareOpsCost * 0.4) * 3
    const nutanixTco3yr   = (nutanixAnnual   + vmwareOpsCost * 0.6) * 3
    const vmwareTco3yr    = (estimatedCurrentAnnual + vmwareOpsCost) * 3

    res.json({
      inputs:  { vmCount, avgVcpu, avgRamGb, avgStorageGb, licenseTier, contractRenewalMonths },
      sizing:  { totalVcpu, totalRamGb, totalStorageTb: totalStorageTb.toFixed(1), avsNodes, nutanixNodes },
      comparison: {
        currentVmware: {
          label:      'Current VMware',
          annualCost: Math.round(estimatedCurrentAnnual),
          monthlyCost: Math.round(estimatedCurrentAnnual / 12),
          tco3yr:     Math.round(vmwareTco3yr),
          notes:      currentAnnualLicenseCost ? 'Advisor-provided figure' : `Estimated based on ${vmCount} VMs — Broadcom pricing model`,
          isEstimate: !currentAnnualLicenseCost,
        },
        avs: {
          label:       'Azure VMware Solution',
          nodes:       avsNodes,
          annualCost:  Math.round(avsAnnual),
          monthlyCost: Math.round(avsMonthly),
          tco3yr:      Math.round(avsTco3yr),
          notes:       `${avsNodes} AV36P nodes — includes VMware licensing. Migrate in days.`,
          saving:      Math.round(estimatedCurrentAnnual - avsAnnual),
          savingPct:   Math.round(((estimatedCurrentAnnual - avsAnnual) / estimatedCurrentAnnual) * 100),
        },
        azureIaas: {
          label:       'Azure IaaS (no VMware)',
          annualCost:  Math.round(azureIaasAnnual),
          monthlyCost: Math.round(azureIaasMonthly),
          tco3yr:      Math.round(azureIaasTco3yr),
          notes:       `${vmCount} VMs migrated to Azure — requires re-IP and some app validation. 3-6 months.`,
          saving:      Math.round(estimatedCurrentAnnual - azureIaasAnnual),
          savingPct:   Math.round(((estimatedCurrentAnnual - azureIaasAnnual) / estimatedCurrentAnnual) * 100),
        },
        nutanix: {
          label:       'Nutanix on-premises',
          nodes:       nutanixNodes,
          annualCost:  Math.round(nutanixAnnual),
          monthlyCost: Math.round(nutanixMonthly),
          tco3yr:      Math.round(nutanixTco3yr),
          notes:       `${nutanixNodes} Nutanix nodes — exit VMware licensing, stay on-prem. 3-6 months hardware procurement.`,
          saving:      Math.round(estimatedCurrentAnnual - nutanixAnnual),
          savingPct:   Math.round(((estimatedCurrentAnnual - nutanixAnnual) / estimatedCurrentAnnual) * 100),
        },
      },
      urgency:    contractRenewalMonths <= 6 ? 'critical' : contractRenewalMonths <= 12 ? 'high' : 'standard',
      disclaimer: 'All figures are estimates for planning purposes. Azure pricing varies by region and commitment tier. Nutanix pricing varies by hardware vendor. Request formal quotes before making financial decisions.',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cloud-modernization/blueprint — generate final blueprint
router.post('/blueprint', async (req, res) => {
  try {
    const { scoredWorkloads, summary, requirements, vmwareCalc, clientName, vertical, compliance } = req.body

    const { AzureOpenAI } = await import('openai')
    const aiClient = new AzureOpenAI({
      endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
      apiKey:     process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-08-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    })

    const wave1 = (scoredWorkloads || []).filter(w => w.wave === 1).slice(0, 5)
    const wave2 = (scoredWorkloads || []).filter(w => w.wave === 2).slice(0, 5)
    const wave3 = (scoredWorkloads || []).filter(w => w.wave === 3).slice(0, 5)

    const prompt = `You are a cloud modernization architect at Zones generating a blueprint for a client engagement.

Client: ${clientName}
Industry: ${vertical || 'Technology'}
Compliance: ${compliance?.join(', ') || 'standard'}

WORKLOAD SUMMARY:
- Total workloads: ${summary?.totalWorkloads}
- Rehost: ${summary?.rehost} | Replatform: ${summary?.replatform} | Refactor: ${summary?.refactor} | Repurchase: ${summary?.repurchase} | Retire: ${summary?.retire} | Retain: ${summary?.retain}
- End-of-life workloads: ${summary?.endOfLifeCount}
- Overall approach: ${summary?.recommendedApproach}

MIGRATION WAVES:
Wave 1 (quick wins): ${wave1.map(w => `${w.name} → ${w.recommendedPath}`).join(', ') || 'none'}
Wave 2 (core migration): ${wave2.map(w => `${w.name} → ${w.recommendedPath}`).join(', ') || 'none'}
Wave 3 (complex/critical): ${wave3.map(w => `${w.name} → ${w.recommendedPath}`).join(', ') || 'none'}

REQUIREMENTS:
Target: ${requirements?.targetCloud || 'Azure'}
Timeline: ${requirements?.timeline}
Budget: ${requirements?.budget}
Team capability: ${requirements?.teamCapability}

Generate architecture and roadmap visuals. Return ONLY raw JSON:
{
  "reply": "2-3 sentence executive summary of the modernization strategy for ${clientName}",
  "visuals": [
    {
      "narrative": {
        "headline": "Target architecture headline specific to ${clientName}",
        "context": "2 sentences on the key design decisions",
        "actions": ["Specific action 1", "Specific action 2"]
      },
      "type": "mermaid",
      "title": "${clientName} — Target Cloud Architecture",
      "chart": "graph TD diagram showing source layer (on-prem VMware), migration paths (AVS bridge or direct to Azure), target layer (AKS containers, App Service, Azure SQL, Azure IaaS for retained VMs). Use graph TD, max 10 nodes, subgraph IDs must be single lowercase words with no spaces, no brackets after subgraph ID"
    },
    {
      "narrative": {
        "headline": "Migration wave plan tied to business risk and dependency order",
        "context": "2 sentences on wave sequencing rationale",
        "actions": ["Wave 1 kick-off action", "Wave 2 preparation action"]
      },
      "type": "gantt",
      "title": "Cloud Modernization Roadmap",
      "phases": [
        {
          "name": "Wave 1 — Quick Wins & Foundation",
          "days": "1-60",
          "color": "#3DBA7E",
          "tasks": [
            "Specific task from wave 1 workloads with owner and output",
            "Azure landing zone setup (Cloud Architect, 2 weeks) — Output: governance baseline",
            "Specific task with owner and output"
          ]
        },
        {
          "name": "Wave 2 — Core Migration",
          "days": "61-150",
          "color": "#4A9FE0",
          "tasks": [
            "Specific task from wave 2 workloads",
            "Containerization pipeline setup (DevOps, 3 weeks)",
            "Specific task with owner and output"
          ]
        },
        {
          "name": "Wave 3 — Complex & Modernize",
          "days": "151-270",
          "color": "#8B5CF6",
          "tasks": [
            "Specific task from wave 3 workloads",
            "PaaS refactoring for web applications",
            "Decommission VMware infrastructure (IT Lead, 2 weeks)"
          ]
        }
      ]
    },
    {
      "narrative": {
        "headline": "Zones engagement investment and ROI",
        "context": "2 sentences on payback framing for ${clientName}",
        "actions": ["Next step for advisor", "Next step for client decision-maker"]
      },
      "type": "scorecard",
      "title": "Modernization Investment & Returns",
      "rows": [
        {"label": "Cloud landing zone & governance", "client": "$25K-$40K", "benchmark": "Industry avg: $30K-$50K"},
        {"label": "Wave 1 — foundation migrations", "client": "$40K-$80K", "benchmark": "Industry avg: $50K-$100K"},
        {"label": "Wave 2 — core workloads", "client": "$80K-$150K", "benchmark": "Industry avg: $100K-$200K"},
        {"label": "Wave 3 — modernization", "client": "$100K-$200K", "benchmark": "Industry avg: $120K-$250K"},
        {"label": "Ongoing cloud managed service", "client": "$10K-$20K/month", "benchmark": "Industry avg: $12K-$25K/month"},
        {"label": "Infrastructure cost reduction", "client": "30-50% vs current", "benchmark": "Industry typical: 25-45%"},
        {"label": "Operational overhead reduction", "client": "40-60%", "benchmark": "Industry typical: 35-55%"},
        {"label": "Total program investment", "client": "${requirements?.budget || '$250K-$500K'}", "benchmark": ""},
        {"label": "Estimated payback period", "client": "18-30 months", "benchmark": "Industry avg: 18-36 months"}
      ]
    }
  ]
}`

    const completion = await aiClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  3000,
    })

    const raw   = completion.choices[0].message.content
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))

    if (result.visuals) {
      result.visuals = result.visuals.map(v => {
        if (v.type === 'mermaid' && v.chart) v.chart = fixMermaidChart(v.chart)
        return v
      })
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
