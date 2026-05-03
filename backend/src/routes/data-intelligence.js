import { Router } from 'express'
import { AzureOpenAI } from 'openai'
import { containers } from '../db.js'
import { fixMermaidChart } from '../utils/mermaid.js'

const router = Router()

function makeAI() {
  return new AzureOpenAI({
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:     process.env.AZURE_OPENAI_KEY,
    apiVersion: '2024-08-01-preview',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  })
}

function parseJSON(raw) {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
}

// GET /api/clients/:id/data-intelligence — load latest session with full results
router.get('/clients/:id/data-intelligence', async (req, res) => {
  try {
    const { resource } = await containers.clients
      .item(req.params.id, req.params.id).read()

    const di = resource?.dataIntelligence
    if (!di?.sessions?.length) return res.json({ hasResults: false })

    const latest = di.sessions[0]
    res.json({
      hasResults:         true,
      session:            latest,
      latestInventory:    di.latestInventory    || [],
      dataHealthProfile:  di.dataHealthProfile,
      recommendedPattern: di.recommendedPattern,
      sessionCount:       di.sessions.length,
      lastUpdated:        di.updatedAt,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clients/:id/data-intelligence — save session
router.post('/clients/:id/data-intelligence', async (req, res) => {
  try {
    const { resource: client } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!client.dataIntelligence) client.dataIntelligence = { sessions: [] }

    const session = {
      id: `di-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body.session,
    }

    client.dataIntelligence.sessions.unshift(session)
    client.dataIntelligence.latestInventory    = req.body.session.inventory     || []
    client.dataIntelligence.dataHealthProfile  = req.body.session.healthProfile || null
    client.dataIntelligence.recommendedPattern = req.body.session.recommendedPattern || null
    client.dataIntelligence.updatedAt          = new Date().toISOString()
    client.updatedAt                           = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(client)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/data-intelligence/analyze — classify inventory and score health
router.post('/analyze', async (req, res) => {
  try {
    const { inventory, clientName, vertical } = req.body
    if (!inventory?.length) return res.status(400).json({ error: 'inventory required' })

    const prompt = `You are a senior data architect at Zones Compass analyzing a client's data source inventory.

Client: ${clientName || 'Unknown'}
Industry: ${vertical || 'Unknown'}

DATA SOURCE INVENTORY:
${inventory.map((s, i) => `${i + 1}. ${s.name} (${s.category || 'unknown'}) — Owner: ${s.owner || 'Unknown'}, Volume: ${s.volume || 'Unknown'}, Update freq: ${s.frequency || 'Unknown'}, API: ${s.hasApi || 'Unknown'}, Consumers: ${(s.consumers || []).join(', ') || 'Unknown'}, Issues: ${s.issues || 'None noted'}`).join('\n')}

Analyze this inventory and return ONLY raw JSON:
{
  "healthProfile": {
    "duplication": <1-5 score>,
    "fragmentation": <1-5 score>,
    "latency": <1-5 score>,
    "governance": <1-5 score>
  },
  "findings": [
    {
      "severity": "critical|warning|info",
      "dimension": "duplication|fragmentation|latency|governance",
      "finding": "Specific finding referencing actual system names",
      "systems": ["system names involved"],
      "impact": "Business impact in one sentence"
    }
  ],
  "primaryProblem": "duplication|fragmentation|latency|governance|mixed",
  "optimizeExisting": true|false,
  "existingStrengths": ["What they already have that can be leveraged"],
  "summary": "2-3 sentence executive summary of the data landscape"
}

SCORING RULES:
- Duplication: 1=no overlap, 5=same data in 4+ systems with no master record
- Fragmentation: 1=data naturally separate, 5=nothing can be analyzed without joining 4+ sources
- Latency: 1=real-time everywhere, 5=everything is batch and consumers need real-time
- Governance: 1=full lineage and classification, 5=no policies, no lineage, multiple quality issues
- optimizeExisting=true if they already have the RIGHT tools (Snowflake, Fabric, Databricks) and the problem is adoption/configuration not tooling`

    const ai = makeAI()
    const completion = await ai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens:  2000,
    })

    const result = parseJSON(completion.choices[0].message.content)
    res.json(result)
  } catch (err) {
    console.error('DI analyze error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/data-intelligence/recommend — generate solution recommendation
router.post('/recommend', async (req, res) => {
  try {
    const { inventory, healthProfile, requirements, findings, clientName, vertical, existingTools, optimizeExisting } = req.body

    const PATTERNS = `
DATA FABRIC: Best for heterogeneous sources, compliance requirements, semantic layer needs. Key products: Microsoft Fabric, IBM Watson Knowledge Catalog, Informatica IDMC.
DATA LAKEHOUSE: Best for analytics-heavy, large volume, strong data engineering team. Key products: Databricks Unity Catalog, Snowflake, Microsoft Fabric.
DATA MESH: Best for large enterprises with domain teams who own data products. Requires strong governance culture. Key products: Atlan, Collibra + cloud platform.
UNIFIED API LAYER: Best for operational/real-time use cases, AI agent consumption, app integration. Key products: Azure API Management + Event Grid, MuleSoft, Kong.
MDM (Master Data Management): Best when core problem is duplicate entity records (customer, product, employee). Key products: Informatica MDM, SAP MDM, Microsoft Purview.
EVENT-DRIVEN INTEGRATION: Best for real-time sync across operational systems. Key products: Azure Event Grid, Apache Kafka, Azure Service Bus.
OPTIMIZE EXISTING: Client already has the right platform — focus on configuration, adoption, and governance patterns.`

    const prompt = `You are a senior data solutions architect at Zones Compass recommending a data consolidation strategy.

Client: ${clientName || 'Unknown'}
Industry: ${vertical || 'Unknown'}
Existing tools: ${(existingTools || []).join(', ') || 'Unknown'}
Optimize existing (not replace): ${optimizeExisting}

DATA HEALTH PROFILE:
- Duplication: ${healthProfile?.duplication}/5
- Fragmentation: ${healthProfile?.fragmentation}/5
- Latency: ${healthProfile?.latency}/5
- Governance: ${healthProfile?.governance}/5
Primary problem: ${requirements?.primaryProblem || 'mixed'}

REQUIREMENTS:
- Primary goal: ${requirements?.primaryGoal}
- Timeline: ${requirements?.timeline}
- Budget: ${requirements?.budget}
- Team capability: ${requirements?.teamCapability}
- Compliance: ${(requirements?.compliance || []).join(', ') || 'standard'}
- Preserve existing: ${(requirements?.preserveExisting || []).join(', ') || 'none specified'}

KEY FINDINGS:
${(findings || []).slice(0, 5).map(f => `- [${f.severity}] ${f.finding}`).join('\n') || 'None'}

AVAILABLE PATTERNS:
${PATTERNS}

Return ONLY raw JSON:
{
  "primaryPattern": {
    "name": "Pattern name",
    "rationale": "3-4 sentences explaining exactly why this pattern fits their specific inventory, scores, and requirements. Reference actual system names and scores.",
    "solves": ["Specific finding it addresses"],
    "doesNotSolve": ["What this pattern will not fix — be honest"],
    "keyProducts": [
      {
        "name": "Specific product name",
        "reason": "Why this product specifically given their existing stack",
        "alreadyHave": true
      }
    ],
    "complexity": "low|medium|high",
    "timeToValue": "Realistic timeline given their team capability"
  },
  "secondaryPattern": {
    "name": "Complementary pattern name",
    "rationale": "2 sentences on when to add this as Phase 2",
    "keyProducts": [{"name": "...", "reason": "...", "alreadyHave": false}]
  },
  "optimizeExistingPath": ${optimizeExisting ? `{
    "focus": "What to configure/adopt rather than replace",
    "quickWins": ["3-5 specific configuration changes that deliver immediate value"],
    "adoptionGaps": ["Where current tools are underutilized"]
  }` : 'null'},
  "assessmentImpacts": [
    {
      "pillar": "operations|risk|strategy|governance",
      "questionHint": "Which type of question this affects",
      "proposedAnswer": "Not started|In progress|Implemented|Optimized",
      "reason": "Why this finding maps to this answer"
    }
  ],
  "zonesEngagement": {
    "type": "Discovery SOW|Implementation|Managed Service|Optimize & Govern",
    "phases": [
      {"name": "Phase name", "duration": "X weeks", "deliverable": "What Zones delivers"}
    ],
    "investmentRange": "$XXK-$XXK",
    "managedServiceOption": "Description of ongoing Zones managed service"
  }
}`

    const ai = makeAI()
    const completion = await ai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  3000,
    })

    const result = parseJSON(completion.choices[0].message.content)
    res.json(result)
  } catch (err) {
    console.error('DI recommend error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/data-intelligence/blueprint — generate architecture diagram + visuals
router.post('/blueprint', async (req, res) => {
  try {
    const { inventory, recommendation, requirements, clientName, optimizeExisting } = req.body

    const sources    = (inventory || []).slice(0, 10).map(s => s.name)
    const pattern    = recommendation?.primaryPattern?.name || 'Data Fabric'
    const products   = (recommendation?.primaryPattern?.keyProducts || []).map(p => p.name)
    const compliance = requirements?.compliance || []
    const investRange = recommendation?.zonesEngagement?.investmentRange || '$75K-$200K'

    const prompt = `You are a data architect creating a visual architecture diagram for a client presentation.

Client: ${clientName}
Pattern: ${pattern}
Their data sources (pick the 5 most important): ${sources.slice(0, 5).join(', ')}
Recommended products: ${products.slice(0, 3).join(', ')}
Compliance: ${compliance.join(', ') || 'standard'}
Optimize existing: ${optimizeExisting}

Generate a Mermaid architecture diagram.

STRICT MERMAID SYNTAX RULES — violations cause parse errors:
1. Use "graph TD" as the first line — nothing else
2. Subgraph syntax MUST be: subgraph NODEID followed by a newline, then nodes, then "end"
   CORRECT:   subgraph sources
   WRONG:     subgraph sources [Source Layer]   ← space + bracket causes parse error
   WRONG:     subgraph "sources"                ← quotes not allowed on subgraph name
3. Node IDs must be lowercase letters only — no spaces, no hyphens, no numbers starting the ID
   CORRECT:   d365[Dynamics 365]
   WRONG:     Dynamics 365[Dynamics 365]        ← spaces in node ID
   WRONG:     365d[Dynamics 365]                ← starts with number
4. Node labels in square brackets CAN have spaces: d365[Dynamics 365] is valid
5. Edge labels use pipe syntax: a -->|label| b  OR  a --> b  (no label)
   CORRECT:   d365 -->|to fabric| fabriccore
   WRONG:     d365 --> [label] fabriccore
6. Max 4 subgraphs, max 3 nodes per subgraph, max 10 edges total
7. No special characters in node IDs: no dots, slashes, brackets, quotes, apostrophes
8. Every node ID referenced in an edge MUST be defined in a subgraph first
9. No style statements — they cause parse errors in this renderer
10. Subgraph IDs must also be lowercase letters only

REQUIRED STRUCTURE — 4 subgraphs:
subgraph sources
  (3 most important source systems — pick from: ${sources.slice(0, 3).join(', ')})
end
subgraph integration
  (1-2 integration/orchestration products — from: ${products.slice(0, 2).join(', ')})
end
subgraph consumption
  (reporting, aiagents, apps — 3 nodes max)
end
subgraph governance
  (compliance, lineage — 2 nodes max)
end

Then edges connecting sources → integration → consumption, and governance connecting to integration.

VALID EXAMPLE to follow exactly:
graph TD
  subgraph sources
    crm[Dynamics 365]
    db[SQL Server]
    itsm[ServiceNow]
  end
  subgraph integration
    fabric[Microsoft Fabric]
    purview[Microsoft Purview]
  end
  subgraph consumption
    reporting[Reporting]
    agents[AI Agents]
    apps[Operations]
  end
  subgraph governance
    compliance[SOC 2 Controls]
    lineage[Data Lineage]
  end
  crm -->|ingest| fabric
  db -->|ingest| fabric
  itsm -->|ingest| fabric
  fabric --> reporting
  fabric --> agents
  fabric --> apps
  purview --> lineage
  fabric --> lineage

Return ONLY raw JSON with this structure — no markdown fences:
{
  "reply": "2-3 sentence description of what this architecture achieves for ${clientName}",
  "visuals": [
    {
      "narrative": {
        "headline": "Specific headline about what this architecture enables for ${clientName}",
        "context": "2 sentences on the key design decisions and why they fit this client's constraints",
        "actions": ["First specific implementation step with owner", "Second specific step with timeline"]
      },
      "type": "mermaid",
      "title": "${clientName} — Target Data Architecture",
      "chart": "<THE MERMAID CHART — must follow ALL rules above>"
    },
    {
      "narrative": {
        "headline": "Implementation roadmap for ${pattern}",
        "context": "2 sentences on sequencing decisions and first quick win",
        "actions": ["Week 1-2 action with owner", "Month 1 milestone with deliverable"]
      },
      "type": "gantt",
      "title": "Data Intelligence Implementation Plan",
      "phases": [
        {
          "name": "${optimizeExisting ? 'Phase 1 — Optimize & Configure' : 'Phase 1 — Foundation'}",
          "days": "1-30",
          "color": "#E8A838",
          "tasks": [
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output"
          ]
        },
        {
          "name": "Phase 2 — Integration",
          "days": "31-60",
          "color": "#4A9FE0",
          "tasks": [
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output"
          ]
        },
        {
          "name": "Phase 3 — Govern & Scale",
          "days": "61-90",
          "color": "#3DBA7E",
          "tasks": [
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output",
            "Specific task — owner, duration, output"
          ]
        }
      ]
    },
    {
      "narrative": {
        "headline": "Investment and returns for ${clientName}",
        "context": "2 sentences on ROI framing and payback period for this pattern",
        "actions": ["Next step for the advisor to progress the engagement", "Next step for the client to confirm budget"]
      },
      "type": "scorecard",
      "title": "Your Data Intelligence Investment",
      "rows": [
        {"label": "Discovery & assessment", "client": "$15K-$25K", "benchmark": "Industry avg: $20K-$35K"},
        {"label": "Platform implementation", "client": "${investRange}", "benchmark": "Industry avg: varies by scale"},
        {"label": "Ongoing managed service", "client": "$8K-$15K/month", "benchmark": "Industry avg: $10K-$20K/month"},
        {"label": "Time to first insight", "client": "4-6 weeks", "benchmark": "Industry avg: 6-12 weeks"},
        {"label": "Reporting accuracy improvement", "client": "60-80%", "benchmark": "Industry typical: 50-75%"},
        {"label": "Pipeline maintenance reduction", "client": "40-60%", "benchmark": "Industry typical: 35-55%"},
        {"label": "Total Year 1 investment", "client": "${investRange}", "benchmark": ""}
      ]
    }
  ]
}`

    const ai = makeAI()
    const completion = await ai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  3000,
    })

    const result = parseJSON(completion.choices[0].message.content)

    // Fix any Mermaid syntax errors before sending to the client
    if (result.visuals) {
      result.visuals = result.visuals.map(visual => {
        if (visual.type === 'mermaid' && visual.chart) {
          visual.chart = fixMermaidChart(visual.chart)
        }
        return visual
      })
    }

    res.json(result)
  } catch (err) {
    console.error('DI blueprint error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
