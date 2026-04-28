import express from "express"
import cors from "cors"
import "dotenv/config"
import { AzureOpenAI } from "openai"
import { initDb } from "./db.js"
import clientRoutes from "./routes/clients.js"
import assessmentRoutes from "./routes/assessments.js"
import sessionRoutes from "./routes/sessions.js"

const app = express()
app.use(cors())
app.use(express.json())

const openai = new AzureOpenAI({
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiKey:     process.env.AZURE_OPENAI_KEY,
  apiVersion: "2024-08-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
})

const SYSTEM_PROMPT = `You are a senior AI strategy consultant at Zones Innovation Center with 15 years of enterprise AI advisory experience. You help Zones consultants and their clients analyse AI maturity assessment results across 5 pillars: Governance, Risk and Compliance, AI Strategy, Operations, and Enablement. You speak directly, make specific recommendations, and back everything up with reasoning. You do not hedge with generic statements.

CONSULTING PRINCIPLES — follow these in every response:

1. BE SPECIFIC, NOT GENERIC
   Bad: "You should address organisational bottlenecks and technical silos systematically."
   Good: "For [client], the primary gap is the disconnection between their ServiceNow ITSM and Databricks platform. Here are 5 specific steps to bridge them, starting with an API gateway layer deployable in Week 1."

2. REFERENCE THE CLIENT'S ACTUAL DATA
   Always reference their specific pillar scores, named tools, deployment model, and compliance requirements. Never give advice that could apply to any client.
   Bad: "You should improve your risk management processes."
   Good: "Your Risk score of 3.4/5 sits just below the 3.5 'Managed' threshold. The two questions dragging it down are model monitoring (In progress) and vendor risk assessments (Not started). Here is what closing those gaps looks like in 60 days."

3. WHEN ASKED FOR STEPS, GIVE ACTUAL STEPS
   Include who does it, what tool they use, what the output is, and how long it takes.
   Bad: "Step 1: Identify barriers. Step 2: Assess root causes."
   Good: "Step 1 (Day 1–2): The IT Lead maps all agent-to-agent data flows in Miro. Output: visual showing every point where Agent A cannot access data owned by Agent B. Time: 4 hours with 2 people."

4. MAKE RECOMMENDATIONS, NOT LISTS OF OPTIONS
   Bad: "You could consider Option A, B, or C depending on your priorities."
   Good: "I recommend Option B — Azure Arc as the integration layer — for three reasons specific to this client's hybrid environment: [specific reasons]. Option A requires a cloud migration they are not ready for."

5. LENGTH AND FORMAT
   - Short direct questions: 2–4 sentences, no visual
   - "Explain" or "give me detail" requests: structured numbered response
   - "Step by step" requests: numbered steps with specifics
   - Never pad with preamble ("Great question! I'd be happy to help...")
   - Never end with "Let me know if you need anything else"
   - Never recommend cloud-only solutions for on-premises or air-gapped clients

CRITICAL RULE — VISUAL RESPONSES:
When a question involves plans, roadmaps, timelines, benchmark comparisons, prioritization, improvement steps, phases, quick wins, or checklists, you MUST respond with ONLY a raw JSON object. No markdown code fences. No text before or after the JSON. The entire response must be valid JSON matching this exact envelope:
{"text":"1–2 sentence intro shown above the visual","visual":{"type":"gantt","title":"...","phases":[...]}}

Available visual types and their exact schemas:

gantt — for 90-day plans, phased programs:
{"text":"intro","visual":{"type":"gantt","title":"90-Day Risk Improvement Plan","phases":[{"name":"Phase 1 — Foundation","days":"1–30","color":"#E8A838","tasks":["task 1","task 2","task 3"]},{"name":"Phase 2 — Implementation","days":"31–60","color":"#4A9FE0","tasks":["task 1","task 2"]},{"name":"Phase 3 — Optimization","days":"61–90","color":"#3DBA7E","tasks":["task 1","task 2"]}]}}

priority_matrix — for prioritization, quick wins, executive readout prep:
{"text":"intro","visual":{"type":"priority_matrix","title":"Initiative Prioritization","items":[{"label":"short label","quadrant":"quick_win"},{"label":"short label","quadrant":"strategic"},{"label":"short label","quadrant":"fill_in"},{"label":"short label","quadrant":"thankless"}]}}
quadrant must be exactly one of: quick_win | strategic | fill_in | thankless. Use 6–10 items total spread across all four quadrants.

timeline — for milestone sequences, roadmaps:
{"text":"intro","visual":{"type":"timeline","title":"Roadmap","milestones":[{"date":"Week 1–2","label":"Milestone","color":"#4A9FE0","description":"one sentence"}]}}

scorecard — for benchmark comparisons (ALWAYS use this for "compare to industry" questions):
{"text":"intro","visual":{"type":"scorecard","title":"Client vs Industry Benchmarks","rows":[{"label":"Governance","client":3.2,"benchmark":3.1},{"label":"Risk & Compliance","client":2.8,"benchmark":3.3},{"label":"AI Strategy","client":3.5,"benchmark":3.6},{"label":"Operations","client":2.9,"benchmark":3.4},{"label":"Enablement","client":3.1,"benchmark":3.2}]}}
Always include all 5 pillars. Use client's actual scores. Use realistic industry benchmarks in the 2.8–3.8 range.

checklist — for action item lists:
{"text":"intro","visual":{"type":"checklist","title":"Quick Wins Checklist","categories":[{"name":"Category Name","color":"#EC4899","items":["action 1","action 2"]}]}}

maturity_journey — for maturity path, future state, 12/24 month targets, progression, target state, "where should we be", journey questions. ALWAYS use the client's actual pillar scores as current values:
{"text":"intro","visual":{"type":"maturity_journey","title":"AI Maturity Journey","pillars":[{"name":"Governance","current":3.2,"target_6m":3.8,"target_12m":4.2,"target_24m":4.8},{"name":"Risk","current":2.1,"target_6m":2.8,"target_12m":3.5,"target_24m":4.2},{"name":"Strategy","current":4.0,"target_6m":4.2,"target_12m":4.5,"target_24m":4.8},{"name":"Operations","current":2.8,"target_6m":3.2,"target_12m":3.8,"target_24m":4.5},{"name":"Enablement","current":1.9,"target_6m":2.5,"target_12m":3.2,"target_24m":4.0}]}}

raci_matrix — for "who owns", accountability, RACI, roles, governance structure, responsible, "who should" questions:
{"text":"intro","visual":{"type":"raci_matrix","title":"AI Governance RACI","roles":["CIO","AI Lead","Risk Officer","Legal","Business Unit"],"items":[{"activity":"AI Strategy approval","assignments":["A","R","C","C","I"]},{"activity":"Model deployment","assignments":["I","R","C","I","C"]},{"activity":"Risk assessment","assignments":["A","C","R","C","I"]},{"activity":"Data governance","assignments":["A","R","R","C","C"]},{"activity":"Compliance review","assignments":["I","C","C","R","I"]},{"activity":"Vendor selection","assignments":["A","R","C","C","C"]}]}}
assignments array length must match roles array length. Values must be R, A, C, or I only.

risk_heatmap — for risk map, risk profile, heat map, likelihood, impact, risk assessment, "risks identified" questions:
{"text":"intro","visual":{"type":"risk_heatmap","title":"AI Risk Heat Map","risks":[{"label":"Model bias","likelihood":3,"impact":5},{"label":"Data breach","likelihood":2,"impact":5},{"label":"Regulatory non-compliance","likelihood":3,"impact":4},{"label":"Shadow AI","likelihood":4,"impact":3},{"label":"Vendor lock-in","likelihood":3,"impact":3},{"label":"Skills gap","likelihood":4,"impact":2},{"label":"Model drift","likelihood":3,"impact":3}]}}
likelihood and impact must be integers 1–5.

reference_architecture — triggered by: "architecture", "platform", "infrastructure", "tech stack", "what should we build", "design", "blueprint". Return type MUST be "mermaid". Use a Mermaid graph TD diagram with subgraphs for each layer:
{"text":"intro","visual":{"type":"mermaid","title":"AI Platform Reference Architecture","chart":"graph TD\n  subgraph GOV[\"🔒 Governance & Policy\"]\n    G1[Ethics Framework]\n    G2[Risk Monitor]\n    G3[Audit Logging]\n  end\n  subgraph AI[\"🤖 AI / ML Layer\"]\n    A1[Model Training]\n    A2[Model Registry]\n    A3[Inference Engine]\n    A4[Bias Detection]\n  end\n  subgraph DATA[\"💾 Data Layer\"]\n    D1[Data Lake]\n    D2[Feature Store]\n    D3[Data Quality]\n  end\n  subgraph INFRA[\"☁️ Infrastructure\"]\n    I1[Azure ML]\n    I2[Compute]\n    I3[Storage]\n  end\n  GOV --> AI\n  AI --> DATA\n  DATA --> INFRA\n  style GOV fill:#2D0F1E,stroke:#EC4899\n  style AI fill:#1E0D3D,stroke:#8B5CF6\n  style DATA fill:#0D1E3D,stroke:#4A9FE0\n  style INFRA fill:#0D2E1E,stroke:#3DBA7E"}}

process_flow — triggered by: "process", "flow", "workflow", "steps to", "how to", "procedure", "sequence", "diagram". Return type MUST be "mermaid". Use a Mermaid flowchart:
{"text":"intro","visual":{"type":"mermaid","title":"Process Title","chart":"flowchart TD\n  A([Start]) --> B[Step one]\n  B --> C{Decision?}\n  C -->|Yes| D[Action A]\n  C -->|No| E[Action B]\n  D --> F([End])\n  E --> F\n  style A fill:#1A56A8,stroke:#4A9FE0,color:#fff\n  style F fill:#3DBA7E,stroke:#3DBA7E,color:#fff"}}

sequence_diagram — triggered by: "sequence", "interaction", "communication between", "how do systems talk", "API flow", "integration diagram". Return type MUST be "mermaid". Use a Mermaid sequenceDiagram:
{"text":"intro","visual":{"type":"mermaid","title":"System Interaction","chart":"sequenceDiagram\n  participant C as Client\n  participant API as Zones API\n  participant AI as Azure OpenAI\n  participant DB as Cosmos DB\n  C->>API: Submit assessment answer\n  API->>DB: Save answer\n  API->>AI: Request gap analysis\n  AI-->>API: Return recommendations\n  API-->>C: Visual response"}}

vendor_comparison — triggered by: "compare", "versus", "vs", "pros and cons", "which is better", "recommend a tool", "suggest platforms", "options for". Shows a structured vendor comparison:
{"text":"intro","visual":{"type":"vendor_comparison","title":"Agent Platform Comparison","criteria":["Scalability","Integration","Customization","Cost","Enterprise Support"],"vendors":[{"name":"Azure AI Foundry","recommended":true,"scores":{"Scalability":5,"Integration":5,"Customization":4,"Cost":3,"Enterprise Support":5},"pros":["Native Azure integration","Enterprise-grade security","Co-sell eligible"],"cons":["Azure dependency","Learning curve"]},{"name":"OpenAI GPT","recommended":false,"scores":{"Scalability":4,"Integration":4,"Customization":3,"Cost":3,"Enterprise Support":3},"pros":["Advanced NLP","Wide ecosystem"],"cons":["Limited customization","Resource intensive"]},{"name":"Google Dialogflow","recommended":false,"scores":{"Scalability":4,"Integration":4,"Customization":3,"Cost":4,"Enterprise Support":4},"pros":["Easy integration","Intent recognition"],"cons":["Limited advanced control"]},{"name":"Rasa","recommended":false,"scores":{"Scalability":3,"Integration":3,"Customization":5,"Cost":5,"Enterprise Support":2},"pros":["Open source","Full control"],"cons":["Requires deep technical expertise"]}]}}

MULTI-VISUAL ACTION PLAN FORMAT:
When asked for a "complete action plan" or "full plan" with multiple deliverables, respond with a visuals array instead of a single visual:
{"text":"2-3 sentence executive summary of the plan","visuals":[...]}
Include 3-4 visuals. Each visual must follow its exact schema from above. The visuals array replaces the single visual field.

CRITICAL — Each visual object in the visuals array MUST include a "narrative" field placed BEFORE the visual data fields. The narrative makes the PDF export usable as a standalone sales and delivery document:
{
  "narrative": {
    "headline": "One punchy 'so what' sentence — make it specific to this client and initiative",
    "context": "2-3 sentences explaining why this section matters, referencing the client's actual pillar scores and named gaps. Write as a senior Zones consultant briefing a client — direct, prescriptive, no generic language.",
    "actions": [
      "Specific immediate action item 1 the salesperson or client must take",
      "Specific immediate action item 2",
      "Specific immediate action item 3"
    ]
  },
  "type": "gantt",
  "title": "...",
  ...rest of visual schema
}

Example action plan response shape:
{"text":"Executive summary 2-3 sentences.","visuals":[{"narrative":{"headline":"Execution window is tight — 10 business days to deliver prioritized findings","context":"With an Enablement score of 1.9, this client has the lowest AI literacy baseline in the assessed cohort. The workshop must surface the top 3 training priorities before the executive readout in Week 2.","actions":["Secure CIO sponsorship before Day 1","Pre-brief IT lead on workshop agenda by end of Week 1","Escalate any data access blockers to legal immediately"]},"type":"gantt","title":"Week-by-Week Timeline","phases":[...]},{"narrative":{...},"type":"raci_matrix",...}]}

PLAIN TEXT RESPONSES:
For gap analysis explanations, general advice, greetings, and questions not requiring a visual — respond with plain text only (2–4 short paragraphs). Never wrap plain text in JSON.

REMEMBER: When returning a visual, your ENTIRE response must be the JSON object. Start with { and end with }. Nothing else.`

const VISUAL_TYPES = new Set([
  "gantt", "scorecard", "priority_matrix", "timeline", "checklist",
  "reference_architecture", "maturity_journey", "raci_matrix", "risk_heatmap", "process_flow",
  "mermaid", "vendor_comparison", "agent_spec",
])

function extractVisualFromResponse(raw) {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const firstBrace = cleaned.indexOf("{")

  if (firstBrace === -1) {
    return { text: raw, visual: null, visuals: [], agents: [] }
  }

  let jsonStr = cleaned.slice(firstBrace)
  const lastBrace = jsonStr.lastIndexOf("}")

  if (lastBrace === -1) {
    // Response was truncated — attempt recovery by closing open brackets
    console.warn("[extract] JSON appears truncated, attempting bracket recovery")
    let opens = 0, arrOpens = 0
    for (const ch of jsonStr) {
      if (ch === '{') opens++
      if (ch === '}') opens--
      if (ch === '[') arrOpens++
      if (ch === ']') arrOpens--
    }
    jsonStr += ']'.repeat(Math.max(0, arrOpens))
    jsonStr += '}'.repeat(Math.max(0, opens))
  } else {
    jsonStr = jsonStr.slice(0, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)
    const summaryText = parsed.reply ?? parsed.text ?? ""

    // Case 1 — { reply/text, visuals: [...] }  (multi-visual / agent design)
    if (Array.isArray(parsed.visuals)) {
      const valid = parsed.visuals.filter(v => v?.type && VISUAL_TYPES.has(v.type))
      console.log(`[extract] multi-visual: ${valid.length} valid visuals, summary: "${String(summaryText).slice(0, 60)}"`)
      return { text: summaryText, visual: valid[0] || null, visuals: valid, agents: [] }
    }

    // Case 2 — { reply/text, visual: {...} }  (single visual)
    if (parsed.visual?.type && VISUAL_TYPES.has(parsed.visual.type)) {
      console.log(`[extract] single visual: ${parsed.visual.type}`)
      return { text: summaryText, visual: parsed.visual, visuals: [parsed.visual], agents: [] }
    }

    // Case 3 — the whole object IS a visual
    if (parsed.type && VISUAL_TYPES.has(parsed.type)) {
      console.log(`[extract] bare visual: ${parsed.type}`)
      return { text: "", visual: parsed, visuals: [parsed], agents: [] }
    }

    // Case 4 — agents array (discover response)
    if (parsed.agents && Array.isArray(parsed.agents)) {
      return { text: "", visual: null, visuals: [], agents: parsed.agents }
    }

    console.warn("[extract] no visual found in parsed JSON, keys:", Object.keys(parsed).join(", "))
    return { text: raw, visual: null, visuals: [], agents: [] }
  } catch (e) {
    console.error("[extract] JSON parse failed after recovery attempt:", e.message)
    console.error("[extract] attempted (first 300):", jsonStr.slice(0, 300))
    return { text: raw, visual: null, visuals: [], agents: [] }
  }
}

app.use("/api/clients", clientRoutes)
app.use("/api/assessments", assessmentRoutes)
app.use("/api/sessions", sessionRoutes)

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, clientContext } = req.body
    if (!messages?.length) return res.status(400).json({ error: "messages required" })

    // Pre-compute all context variables before building template string
    const ep = clientContext?.environmentProfile || {}
    const deploymentRule = (() => {
      const dm = ep.deploymentModel
      if (!dm || dm === 'cloud_native') return 'Cloud native: recommend any cloud AI service freely'
      if (dm === 'hybrid')     return 'Hybrid: recommend Azure Arc and hybrid-compatible architectures; flag data movement considerations'
      if (dm === 'on_prem')    return 'On-premises: do NOT recommend cloud-only AI APIs as primary runtime; local inference required'
      if (dm === 'air_gapped') return 'Air-gapped: ALL recommendations must have zero internet dependency; only local model inference; flag this prominently'
      return `Deployment: ${dm}`
    })()
    const complianceList = ep.complianceFrameworks || []
    const complianceRules = [
      complianceList.includes('hipaa')   ? 'HIPAA: no PHI can leave the client environment; use private endpoints' : '',
      complianceList.includes('fedramp') ? 'FedRAMP/ITAR: government cloud or on-prem only' : '',
      complianceList.includes('itar')    ? 'ITAR: on-prem or GovCloud only; strict data export controls' : '',
      complianceList.includes('gdpr')    ? 'GDPR: enforce EU data residency in all recommendations' : '',
    ].filter(Boolean).join('. ')
    const legacyNote = (ep.legacySystems || []).length > 0
      ? `Legacy systems present: ${ep.legacySystems.join(', ')} — treat as highest-value integration targets`
      : ''

    // Compute lowest scoring pillar for quick reference
    const lowestPillar = (() => {
      const s = clientContext?.scores || {}
      const valid = Object.entries(s).filter(([, v]) => v !== null && v !== undefined)
      if (!valid.length) return 'Not assessed'
      const [pillar, score] = valid.sort(([, a], [, b]) => a - b)[0]
      return `${pillar} (${score}/5)`
    })()

    const clientSection = clientContext ? `
---
CURRENT CLIENT CONTEXT — reference this specific data in every response:
Client: ${clientContext.name || 'Unknown'}
Industry: ${clientContext.industry || 'Not specified'}
Overall maturity: ${clientContext.overallScore ?? 'Not assessed'}/5
Pillar scores: Governance ${clientContext.scores?.governance ?? '?'}/5, Risk ${clientContext.scores?.risk ?? '?'}/5, Strategy ${clientContext.scores?.strategy ?? '?'}/5, Operations ${clientContext.scores?.operations ?? '?'}/5, Enablement ${clientContext.scores?.enablement ?? '?'}/5
Lowest scoring pillar: ${lowestPillar}
Deployment model: ${ep.deploymentModel || 'not specified'} — ${deploymentRule}
Cloud tools: ${(ep.cloudTools || []).join(', ') || 'not specified'}
On-premises tools: ${(ep.onPremTools || []).join(', ') || 'none'}
Legacy systems: ${(ep.legacySystems || []).join(', ') || 'none'}
Compliance: ${complianceList.join(', ') || 'none'}${complianceRules ? `\nCompliance rules: ${complianceRules}` : ''}${legacyNote ? `\n${legacyNote}` : ''}
Assessment detail: ${JSON.stringify(clientContext.answers || {})}
---
You MUST reference this client's specific scores, tools, and deployment model in your response. Do not give generic advice that could apply to any client.`
    : `
---
NO CLIENT SELECTED — you have no client context.
State clearly that your response is generic. Recommend selecting a client for specific advice.
Do not fabricate client data.
---`

    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:    [
        { role: "system", content: SYSTEM_PROMPT + clientSection },
        ...messages.slice(-12),
      ],
      temperature: 0.6,
      max_tokens:  1500,
    })

    const rawContent = completion.choices[0].message.content.trim()
    console.log("[chat] raw GPT response:", rawContent.slice(0, 300))

    const extracted = extractVisualFromResponse(rawContent)
    const reply   = extracted.text || rawContent
    const visual  = extracted.visual  || null
    const visuals = extracted.visuals || []
    console.log("[chat] extracted — reply:", reply?.slice(0, 100), "| visual:", visual?.type ?? "none", "| visuals:", visuals.length)

    const showAgentStudio = /\b(agent|automate|automation|workflow|orchestrat)\b/i.test(reply)

    res.json({ reply, visual, visuals, showAgentStudio })
  } catch (err) {
    console.error("Azure OpenAI error:", err.message)
    res.status(500).json({ error: "Failed to get AI response", detail: err.message })
  }
})

const DISCOVER_SYSTEM_PROMPT = `You are an AI agent design specialist for Zones Innovation Center. Identify the highest-value AI agent opportunities for enterprise clients based on their industry, tooling stack, deployment model, compliance requirements, and maturity gaps.

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "agents": [
    {
      "id": "unique-kebab-slug",
      "name": "Agent Name",
      "purpose": "One sentence — what this agent does and why it matters for this industry",
      "pillar": "risk|governance|strategy|operations|enablement",
      "tools_required": ["Tool1", "Tool2"],
      "tools_available": ["Tool1"],
      "complexity": "quick_win|strategic|complex",
      "fit_score": 94,
      "fit_reason": "One sentence explaining why this agent fits this specific client",
      "estimated_effort": "2-4 weeks",
      "estimated_value": "High|Medium|Low",
      "azure_service": "Primary Azure AI service powering this agent",
      "deployment_note": "One sentence on deployment approach — e.g. 'Deployable on-premises via Azure Arc; no cloud egress required' or omit if cloud_native",
      "compliance_notes": "One sentence on relevant compliance implications — e.g. 'Must enforce HIPAA audit logging and PHI masking at inference layer' or omit if none"
    }
  ]
}

DEPLOYMENT MODEL RULES:
- cloud_native: All Azure services available. No deployment_note needed. Recommend Azure AI Foundry, Azure OpenAI, Cognitive Services freely.
- hybrid: Agent logic may run on-prem via Azure Arc or Azure Stack HCI; data stays on-prem, orchestration in cloud. Note which components are on-prem vs. cloud in deployment_note.
- on_prem: All compute must be on-premises. Prefer open-source models (Llama, Mistral via Ollama) or Azure Stack. Flag any cloud dependency as a blocker. deployment_note is required.
- air_gapped: Fully isolated — no internet connectivity. Only on-prem open-source models. No external API calls. deployment_note is required and must call out air-gap constraint explicitly.

COMPLIANCE RULES (add compliance_notes when relevant):
- HIPAA: PHI must stay on-prem or in HIPAA-BAA-covered storage. Audit all inference. Mask PHI at output.
- SOC 2 / ISO 27001: Logging, access controls, and change management must be built in.
- GDPR: Data residency matters — note EU region or on-prem requirement.
- FedRAMP / CMMC: GovCloud only or on-prem. No commercial multi-tenant endpoints.
- PCI-DSS: No cardholder data in prompts. Tokenize before sending to AI.
- FINRA / SEC: Immutable audit trail for all AI-driven decisions. Human review required.

LEGACY SYSTEM RULES:
- If client has mainframe/COBOL: recommend agents that use API gateway or ETL bridge rather than direct integration.
- If client has SAP: prioritize SAP-certified connectors; agents should read from SAP ERP via OData or BAPIs.
- If client has Salesforce: use Salesforce Einstein or Power Automate connectors; agent should not bypass CRM record locking.

SCORING: fit 80-100 = critical gap + available tools. fit 60-79 = moderate gap or one missing tool. fit <60 = nice-to-have.
Name real industry workflows. Sort by fit_score desc within each complexity group.
Only include deployment_note and compliance_notes fields when they add meaningful context — omit them (or set to null) if not applicable.`


app.post("/api/agents/discover", async (req, res) => {
  try {
    const {
      vertical          = 'Technology',
      tools             = [],
      focusAreas        = [],
      clientScores      = {},
      clientName        = 'Client',
      customDescription = '',
      deploymentModel   = 'cloud_native',
      toolsByCat        = '',
      onPremToolsByCat  = '',
      legacySystems     = '',
      complianceFrameworks = '',
      constraints       = [],
    } = req.body || {}

    const deployLabels = { cloud_native: 'Cloud Native (Azure)', hybrid: 'Hybrid (cloud + on-prem)', on_prem: 'On-Premises', air_gapped: 'Air-Gapped / Disconnected' }
    const deployLabel  = deployLabels[deploymentModel] || deploymentModel || 'Not specified'

    const userPrompt = `Generate ${customDescription ? '1 agent based on this description: "' + customDescription + '" for' : '8-12 AI agent recommendations for'} ${clientName || 'this client'}.
Industry: ${vertical || 'Not specified'}
Deployment model: ${deployLabel}
Cloud tools by category: ${toolsByCat || (tools || []).join(', ') || 'Not specified'}
On-premises tools: ${onPremToolsByCat || 'None'}
Legacy systems: ${legacySystems || 'None'}
Compliance requirements: ${complianceFrameworks || 'None specified'}
Operational constraints: ${Array.isArray(constraints) ? constraints.join(', ') : (constraints || 'None')}
Focus areas: ${Array.isArray(focusAreas) ? focusAreas.join(', ') : (focusAreas || 'All pillars')}
Pillar scores: ${JSON.stringify(clientScores)}${customDescription ? '\nMake this agent specific to the description above while fitting the client context.' : ''}
${deploymentModel === 'air_gapped' ? '\nCRITICAL: All agents must be fully air-gapped compatible — no internet, no external APIs, on-prem open-source models only.' : ''}
${deploymentModel === 'on_prem' ? '\nIMPORTANT: Prefer on-premises deployment paths. Flag any required cloud service clearly.' : ''}`

    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: DISCOVER_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    })

    const raw = completion.choices[0].message.content.trim()
    console.log("[discover] raw response (first 300):", raw.slice(0, 300))
    console.log("[discover] raw response (last 100):", raw.slice(-100))

    const extracted = extractVisualFromResponse(raw)
    console.log("[discover] agents parsed:", extracted.agents?.length || 0)

    if (extracted.agents?.length) {
      return res.json({ agents: extracted.agents })
    }

    // Fallback: try a broader match for wrapped responses
    const jsonMatch = raw.match(/\{[\s\S]*"agents"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const fallback = JSON.parse(jsonMatch[0])
        if (fallback.agents?.length) {
          console.log("[discover] fallback parse succeeded:", fallback.agents.length, "agents")
          return res.json({ agents: fallback.agents })
        }
      } catch (e) {
        console.error("[discover] fallback parse also failed:", e.message)
      }
    }

    console.error("[discover] no agents parsed from response")
    return res.json({ agents: [], debug: raw.slice(0, 500) })
  } catch (err) {
    console.error("Agent discover error:", err.message)
    res.status(500).json({ error: "Failed to generate recommendations", agents: [], detail: err.message })
  }
})

app.post("/api/agents/design", async (req, res) => {
  try {
    const {
      agent              = {},
      clientName         = 'Client',
      clientScores       = {},
      vertical           = 'Technology',
      tools              = [],
      environmentProfile = null,
    } = req.body || {}

    // Build environment constraints before the prompt
    const dm           = environmentProfile?.deploymentModel || 'cloud_native'
    const compliance   = environmentProfile?.complianceFrameworks || []
    const constraints  = environmentProfile?.constraints || []
    const legacySystems = environmentProfile?.legacySystems || []
    const onPremTools  = environmentProfile?.onPremTools || []
    const cloudTools   = environmentProfile?.cloudTools?.length ? environmentProfile.cloudTools : tools
    const noCloudAI    = constraints.includes('no_cloud_ai') || dm === 'air_gapped'
    const isOnPrem     = ['on_prem', 'air_gapped'].includes(dm)
    const isHybrid     = dm === 'hybrid'
    const isAirGapped  = dm === 'air_gapped'

    const availableRuntimes = (() => {
      if (isAirGapped || noCloudAI) return `AVAILABLE AI RUNTIMES (strictly on-premises only):
- Local LLM inference (Ollama, vLLM, or similar)
- NVIDIA GPU servers (if in on-prem infrastructure)
- Edge inference hardware / private model hosting
DO NOT mention Azure OpenAI, Azure AI Foundry, AWS Bedrock, Google Vertex AI, or any cloud AI API as the runtime.
The client has no internet access or has explicitly restricted external AI API usage.`

      if (isOnPrem) return `AVAILABLE AI RUNTIMES (on-premises primary):
- Local model inference preferred (Ollama, vLLM)
- Azure Arc (bridges on-prem to Azure without cloud data egress) is acceptable
- Cloud AI APIs may be referenced as FUTURE state only, not current recommendation
DO NOT recommend cloud-only SaaS AI services as the primary runtime.`

      if (isHybrid) return `AVAILABLE AI RUNTIMES (hybrid — cloud and on-prem):
- Azure AI Foundry / Azure OpenAI acceptable for cloud workloads
- Azure Arc for workloads that span environments
- Local inference for on-premises components
- Clearly separate which components run in cloud vs on-prem`

      return `AVAILABLE AI RUNTIMES (cloud native):
- Azure AI Foundry, Azure OpenAI, AWS Bedrock, Google Vertex AI all acceptable
- Recommend based on tools already in their stack: ${cloudTools.slice(0, 5).join(', ')}`
    })()

    const complianceConstraints = compliance.length > 0 ? `COMPLIANCE CONSTRAINTS — hard requirements:
${compliance.includes('hipaa')   ? '- HIPAA: NO PHI can be processed by external AI APIs. All PHI processing must occur within the client environment.' : ''}
${compliance.includes('fedramp') ? '- FedRAMP: Only FedRAMP-authorised services. Azure Government, AWS GovCloud, or on-premises.' : ''}
${compliance.includes('itar')    ? '- ITAR: Controlled technical data cannot leave US jurisdiction or be processed by foreign-owned services.' : ''}
${compliance.includes('pci')     ? '- PCI-DSS: Cardholder data cannot be sent to external AI services. Stay within the compliant environment.' : ''}
${compliance.includes('gdpr')    ? '- GDPR: Personal data of EU residents cannot leave the EU. Recommend EU-region deployments or on-premises.' : ''}`.trim() : ''

    const legacyContext = legacySystems.length > 0
      ? `LEGACY SYSTEMS IN SCOPE: ${legacySystems.join(', ')}\nThe agent architecture MUST address integration with these systems. Include specific patterns (APIs, ETL, middleware, file-based).`
      : ''

    const onPremContext = onPremTools.length > 0
      ? `ON-PREMISES INFRASTRUCTURE AVAILABLE: ${onPremTools.join(', ')}\nDesign the agent to leverage this existing infrastructure where possible.`
      : ''

    const hasNvidia  = onPremTools.some(t => /nvidia/i.test(t))
    const hasIBM     = [...cloudTools, ...onPremTools].some(t => /\bib[ms]\b|db2|mainframe|as.?400/i.test(t))
    const hasSAP     = [...cloudTools, ...onPremTools].some(t => /\bsap\b/i.test(t))
    const hasUiPath  = [...cloudTools, ...onPremTools].some(t => /uipath/i.test(t))
    const hasSFDC    = cloudTools.some(t => /salesforce/i.test(t))
    const hasSNow    = cloudTools.some(t => /servicenow/i.test(t))

    const buildVsBuyGuidance = (() => {
      if (isAirGapped || (isOnPrem && noCloudAI)) {
        const recommendedModel = hasNvidia
          ? 'Llama 3.1 70B on vLLM (leveraging their NVIDIA GPU infrastructure)'
          : 'Mistral 7B on Ollama (lightweight, runs on standard server hardware without GPU)'
        const altProduct = hasIBM ? 'IBM Watson on-premises' : hasUiPath ? 'UiPath AI Center (on-prem)' : 'NVIDIA AI Enterprise on-premises'
        return `BUILD VS ALTERNATIVES — on-premises/air-gapped environment. Name specific real products.
Recommended: Custom build using ${recommendedModel}
- Specify exactly why this model fits this use case (reasoning capability, context window, hardware fit)
- Hardware requirements: ${hasNvidia ? '2× NVIDIA A100 40GB GPUs already available' : 'CPU-only deployment via Ollama, or add 1× NVIDIA A10 for acceleration'}
- Runtime: ${hasNvidia ? 'vLLM for high-throughput inference' : 'Ollama for ease of deployment'}
Alternative: ${altProduct}
- Choose based on their infrastructure: ${[...cloudTools, ...onPremTools].slice(0, 6).join(', ')}
DO NOT use generic names like "Alternative option" or "Best alternative for their environment".
Include: exact product name, vendor, estimated cost range, deployment timeline, specific compliance fit for ${compliance.join(', ') || 'their requirements'}.`
      }
      if (isHybrid) {
        const altProduct = hasSNow ? 'ServiceNow Now Assist' : hasSFDC ? 'Salesforce Einstein Copilot' : 'Microsoft Copilot Studio'
        return `BUILD VS ALTERNATIVES — hybrid environment. Name specific real products.
Recommended: Custom build on Azure AI Foundry with Azure Arc for hybrid data routing
Alternative: ${altProduct} — chosen because it integrates with tools already in their stack (${cloudTools.slice(0, 5).join(', ')})
Include: exact product names, cost estimates, deployment timelines, compliance fit.
DO NOT use generic names like "Best alternative for their environment".`
      }
      const primaryPlatform = cloudTools.includes('Azure AI Foundry') || cloudTools.includes('Azure') || cloudTools.includes('Azure OpenAI')
        ? 'Azure AI Foundry (Azure OpenAI GPT-4o)'
        : cloudTools.includes('AWS') || cloudTools.includes('AWS Bedrock')
          ? 'AWS Bedrock (Claude 3.5 Sonnet or Titan)'
          : 'GCP Vertex AI (Gemini 1.5 Pro)'
      const altProduct = hasSFDC ? 'Salesforce Einstein Copilot' : hasSNow ? 'ServiceNow Now Assist' : hasSAP ? 'SAP AI Core' : 'Microsoft Copilot Studio'
      return `BUILD VS ALTERNATIVES — cloud native. Name specific real products.
Recommended: Custom build on ${primaryPlatform}
Alternative: ${altProduct} — chosen because it fits their existing stack (${cloudTools.slice(0, 5).join(', ')})
Include: exact product names, cost estimates (e.g. Azure OpenAI GPT-4o at ~$10/1M tokens vs Copilot Studio at $200/tenant/month), deployment timelines, compliance fit.
DO NOT use generic names like "Best alternative for their environment".`
    })()

    const designPrompt = `You are a senior AI solutions architect at Zones Innovation Center designing an agent blueprint for a specific client environment.

CLIENT: ${clientName}
INDUSTRY: ${vertical}
DEPLOYMENT MODEL: ${dm}
SCORES: ${JSON.stringify(clientScores)}

${availableRuntimes}
${complianceConstraints ? '\n' + complianceConstraints : ''}
${legacyContext ? '\n' + legacyContext : ''}
${onPremContext ? '\n' + onPremContext : ''}

AGENT TO DESIGN:
Name: ${agent.name || 'Agent'}
Purpose: ${agent.purpose || ''}
Pillar: ${agent.pillar || 'strategy'}
Tools available to client: ${[...cloudTools, ...onPremTools].join(', ') || 'not specified'}

${buildVsBuyGuidance}

Return ONLY a raw JSON object. Start with { and end with }. No markdown. No code fences. No text outside the JSON.
Include exactly 3 visuals in this order: agent_spec, mermaid, vendor_comparison.
Keep each section concise to avoid truncation. Mermaid chart MAX 6 nodes.

{"reply":"2-3 sentence executive overview referencing the client deployment model and why this agent fits their specific constraints","visuals":[{"narrative":{"headline":"One specific so-what sentence referencing ${clientName} and their actual constraints","context":"2 sentences referencing their ${dm} deployment model and specific compliance or legacy context","actions":["Specific action 1 with owner and timeline","Specific action 2"]},"type":"agent_spec","title":"Agent Specification","name":"${(agent.name || 'Agent').replace(/"/g, '\\"')}","purpose":"Detailed 2-3 sentence purpose specific to this client's environment and tools","trigger":"Specific trigger with example timing (e.g. 'Document upload to SharePoint triggers classification within 30 seconds')","inputs":["Specific input 1 with data format","Specific input 2","Specific input 3"],"outputs":["Specific output 1 with format and destination","Specific output 2","Specific output 3"],"tools":["Only tools available in their environment — NEVER list cloud AI services if on_prem or air_gapped"],"integrations":["Specific integration with method e.g. SAP RFC API call","Specific integration 2 with protocol"],"human_in_loop":"Specific description: who reviews, via what system, within what SLA","latency":"Specific time with breakdown (e.g. 'Processing: 3-5 seconds per document; batch: 500 docs/hour')","data_requirements":"Specific data needs with sensitivity classification","recommended_model":"Specific model name and version with rationale (e.g. 'Llama 3.1 70B — strong reasoning, runs fully on-premises. Requires 2x NVIDIA A100 40GB GPUs. Alternative: Mistral 7B for lighter hardware at reduced accuracy.') — if cloud_native, specify Azure OpenAI GPT-4o or appropriate cloud model","deployment_timeline":"Week-by-week: Week 1-2: [specific tasks with owners], Week 3-4: [specific tasks], Month 2: [specific tasks], Month 3: go-live","estimated_effort":"X weeks with team composition (e.g. '10 weeks: 1 ML engineer, 1 backend developer, 1 DevOps engineer')"},{"narrative":{"headline":"Architecture designed for ${dm} environment — no cloud AI dependencies if restricted","context":"2 sentences on why this architecture suits their deployment constraints and compliance requirements","actions":["Action 1 with owner","Action 2"]},"type":"mermaid","title":"Agent Architecture","chart":"graph TD with MAX 6 nodes. Use ONLY tools available in the client environment. NEVER show Azure OpenAI or cloud AI services if client is on_prem or air_gapped."},{"narrative":{"headline":"Custom build on [specific runtime] recommended over [specific named product]","context":"2 sentences explaining the specific tradeoff between these two named options for ${clientName}","actions":["Specific next step 1 with owner and date","Specific next step 2"]},"type":"vendor_comparison","title":"Build vs Alternatives","criteria":["Time to value","Customisation","Cost","Maintenance","Compliance fit"],"vendors":[{"name":"Custom build — [exact model e.g. Llama 3.1 70B on Ollama / Azure AI Foundry GPT-4o]","recommended":true,"scores":{"Time to value":3,"Customisation":5,"Cost":3,"Maintenance":3,"Compliance fit":5},"pros":["Specific pro referencing their environment","Full control over data — no PHI or sensitive data leaves environment","Specific pro 3"],"cons":["Specific con e.g. Requires 2x NVIDIA A100 GPUs (~$30k)","Specific con 2 with mitigation"]},{"name":"[Specific real product name e.g. IBM Watson on-premises / ServiceNow Now Assist / Salesforce Einstein]","recommended":false,"scores":{"Time to value":4,"Customisation":3,"Cost":2,"Maintenance":4,"Compliance fit":3},"pros":["Specific pro 1","Specific pro 2"],"cons":["Specific con referencing their compliance e.g. Does not meet HIPAA BAA without additional configuration","Specific con 2"]}]}]}`

    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:    [{ role: "user", content: designPrompt }],
      temperature: 0.3,
      max_tokens:  4000,
    })

    const rawContent = completion.choices[0].message.content.trim()
    console.log("[design] response length:", rawContent.length)
    console.log("[design] raw response (first 300):", rawContent.slice(0, 300))
    console.log("[design] raw response (last 100):", rawContent.slice(-100))
    const extracted = extractVisualFromResponse(rawContent)
    console.log("[design] parsed — visuals:", extracted.visuals?.length || 0, extracted.visuals?.map(v => v.type))
    if (!extracted.visuals?.length && !extracted.text) {
      console.error("[design] empty parse result — returning debug info")
      return res.json({ reply: '', visual: null, visuals: [], debug: rawContent.slice(0, 500) })
    }
    res.json({ reply: extracted.text, visual: extracted.visual, visuals: extracted.visuals || [] })
  } catch (err) {
    console.error("Agent design error:", err.message, err.stack)
    res.status(500).json({ error: "Failed to generate blueprint", detail: err.message, visuals: [] })
  }
})

app.get("/api/health", (req, res) => {
  try {
    res.json({
      status: "ok",
      model:  process.env.AZURE_OPENAI_DEPLOYMENT || "not set",
      db:     process.env.COSMOS_ENDPOINT ? "configured" : "not configured",
      env:    process.env.NODE_ENV || "development",
    })
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message })
  }
})

// Global error handler — catches errors passed via next(err)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message, err.stack)
  res.status(500).json({ error: "Internal server error", detail: err.message })
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason)
})

const PORT = process.env.PORT || 8080
app.listen(PORT, async () => {
  console.log(`Zones Advisory API running on :${PORT}`)
  if (process.env.COSMOS_ENDPOINT) await initDb()
  else console.log("Cosmos DB not configured - skipping DB init")
})
