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

const SYSTEM_PROMPT = `You are the Zones AI Advisory Assistant, an expert AI governance and strategy advisor embedded in the Zones AI Advisory Framework tool. You help Zones consultants and their clients by analyzing AI maturity assessment results across 5 pillars: Governance, Risk and Compliance, AI Strategy, Operations, and Enablement. Be concise, specific, and practical.

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
    const { messages, clientContext, format, maxTokens } = req.body
    if (!messages?.length) return res.status(400).json({ error: "messages required" })

    const contextPrompt = clientContext ? `

Current client: ${clientContext.name}
Industry: ${clientContext.industry || 'Not specified'}
Company size: ${clientContext.size || 'Not specified'}
Overall maturity: ${clientContext.overallScore}/5
Pillar scores: ${JSON.stringify(clientContext.scores)}
Assessment answers: ${JSON.stringify(clientContext.answers)}

INFRASTRUCTURE PROFILE:
Deployment model: ${clientContext.environmentProfile?.deploymentModel || 'unknown'}
Cloud tools: ${clientContext.environmentProfile?.cloudTools?.join(', ') || 'Not specified'}
On-premises tools: ${clientContext.environmentProfile?.onPremTools?.join(', ') || 'None'}
Legacy systems: ${clientContext.environmentProfile?.legacySystems?.join(', ') || 'None'}
Compliance requirements: ${clientContext.environmentProfile?.complianceFrameworks?.join(', ') || 'None'}
Constraints: ${clientContext.environmentProfile?.constraints?.join(', ') || 'None'}

CRITICAL INFRASTRUCTURE RULES — follow strictly:
- cloud_native: recommend any cloud AI service freely
- hybrid: recommend Azure Arc and hybrid-compatible architectures; flag data movement considerations
- on_prem: recommend only on-premises or hybrid solutions; do NOT recommend cloud-only AI APIs as primary runtime; flag local inference requirements
- air_gapped: ALL recommendations must be fully self-contained with zero internet dependency; only local model inference; flag this prominently in every response
- HIPAA present: no PHI can leave the client environment; recommend private endpoints
- FedRAMP/ITAR present: government cloud or on-prem only
- GDPR present: enforce EU data residency in all recommendations
- Legacy systems present: always address integration complexity; treat as highest-value agent targets

Use this context to give precise, infrastructure-aware recommendations. Reference actual scores, deployment constraints, and specific gaps in every response.` : `

NO CLIENT SELECTED — You have no client context. Do not generate client-specific recommendations. Clearly state that responses are generic and not tailored to any specific client. Encourage the user to select a client for personalised advisory assistance.`

    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.7,
      max_tokens: maxTokens || 1200,
    })

    const rawContent = completion.choices[0].message.content.trim()
    console.log("[chat] raw GPT response:", rawContent.slice(0, 300))

    let reply   = rawContent
    let visual  = null
    let visuals = null

    if (format !== "text") {
      const extracted = extractVisualFromResponse(rawContent)
      reply   = extracted.text
      visual  = extracted.visual
      visuals = extracted.visuals || []
      console.log("[chat] extracted — reply:", reply?.slice(0, 100), "| visual type:", visual?.type ?? "none", "| visuals:", visuals?.length ?? 0)
    }

    const AGENT_KW = ['agent', 'automate', 'automation', 'workflow', 'orchestrat']
    const lowerReply = (reply || rawContent).toLowerCase()
    const showAgentStudio = AGENT_KW.some(kw => lowerReply.includes(kw))

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

const DESIGN_SYSTEM_PROMPT = `You are a senior AI solutions architect at Zones Innovation Center. Generate a concise but complete agent design blueprint.

Return ONLY a raw JSON object with NO markdown fences, NO text before or after. Start with { and end with }:
{
  "reply": "2-3 sentence executive overview specific to this client",
  "visuals": [
    {
      "narrative": { "headline": "punchy so-what headline", "context": "2 sentences max", "actions": ["Action 1", "Action 2"] },
      "type": "agent_spec",
      "title": "Agent Specification",
      "name": "...",
      "purpose": "...",
      "trigger": "...",
      "inputs": ["..."],
      "outputs": ["..."],
      "tools": ["..."],
      "integrations": ["..."],
      "human_in_loop": "...",
      "latency": "...",
      "data_requirements": "..."
    },
    {
      "narrative": { "headline": "...", "context": "2 sentences max", "actions": ["Action 1", "Action 2"] },
      "type": "mermaid",
      "title": "Agent Architecture",
      "chart": "graph TD with MAX 8 nodes — keep it concise"
    },
    {
      "narrative": { "headline": "...", "context": "2 sentences max", "actions": ["Action 1", "Action 2"] },
      "type": "checklist",
      "title": "Implementation Checklist",
      "categories": [
        { "name": "Prerequisites", "color": "#4A9FE0", "items": ["item 1", "item 2", "item 3"] },
        { "name": "Phase 1 — POC", "color": "#E8A838", "items": ["item 1", "item 2", "item 3"] },
        { "name": "Phase 2 — Production", "color": "#3DBA7E", "items": ["item 1", "item 2", "item 3"] }
      ]
    }
  ]
}

CRITICAL RULES:
- Return ONLY the JSON object. Start with { and end with }
- Keep Mermaid chart to MAX 8 nodes — shorter charts parse more reliably
- Keep each narrative context to 2 sentences maximum
- Keep each actions array to 2 items maximum
- Total response must be under 3000 tokens
- The response will be cut off if too long — prioritise completeness over detail
- Write as a senior Zones consultant. Reference client's actual scores. Be prescriptive.`

app.post("/api/agents/discover", async (req, res) => {
  try {
    const {
      vertical, tools, focusAreas, clientScores, clientName, customDescription,
      deploymentModel, toolsByCat, onPremToolsByCat, legacySystems, complianceFrameworks, constraints,
    } = req.body

    const deployLabels = { cloud_native: 'Cloud Native (Azure)', hybrid: 'Hybrid (cloud + on-prem)', on_prem: 'On-Premises', air_gapped: 'Air-Gapped / Disconnected' }
    const deployLabel  = deployLabels[deploymentModel] || deploymentModel || 'Not specified'

    const userPrompt = `Generate ${customDescription ? '1 agent based on this description: "' + customDescription + '" for' : '8-12 AI agent recommendations for'} ${clientName || 'this client'}.
Industry: ${vertical || 'Not specified'}
Deployment model: ${deployLabel}
Cloud tools by category: ${toolsByCat || (tools || []).join(', ') || 'Not specified'}
On-premises tools: ${onPremToolsByCat || 'None'}
Legacy systems: ${legacySystems || 'None'}
Compliance requirements: ${complianceFrameworks || 'None specified'}
Operational constraints: ${(constraints || []).join(', ') || 'None'}
Focus areas: ${(focusAreas || []).join(', ') || 'All pillars'}
Pillar scores: ${JSON.stringify(clientScores || {})}${customDescription ? '\nMake this agent specific to the description above while fitting the client context.' : ''}
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
    const { agent, clientName, clientScores, vertical, tools } = req.body
    const userPrompt = `Design a complete agent blueprint for: ${agent?.name}
Purpose: ${agent?.purpose}
Client: ${clientName}
Industry: ${vertical}
Available tools: ${(tools || []).join(', ')}
Client scores: ${JSON.stringify(clientScores || {})}
Primary Azure service: ${agent?.azure_service || 'Azure AI Foundry'}
Make the blueprint specific to ${clientName}'s actual gaps and tooling. Reference their pillar scores directly.`

    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: DESIGN_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    })

    const rawContent = completion.choices[0].message.content.trim()
    console.log("[design] raw response (first 500):", rawContent.slice(0, 500))
    console.log("[design] raw response (last 100):", rawContent.slice(-100))
    const extracted = extractVisualFromResponse(rawContent)
    console.log("[design] parsed — visuals:", extracted.visuals?.length || 0, "| reply:", extracted.text?.slice(0, 80))
    if (!extracted.visuals?.length && !extracted.text) {
      console.error("[design] empty parse result — returning debug info")
      return res.json({ reply: '', visual: null, visuals: [], debug: rawContent.slice(0, 500) })
    }
    res.json({ reply: extracted.text, visual: extracted.visual, visuals: extracted.visuals || [] })
  } catch (err) {
    console.error("Agent design error:", err.message)
    res.status(500).json({ error: "Failed to generate blueprint", detail: err.message })
  }
})

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  model: process.env.AZURE_OPENAI_DEPLOYMENT,
  db: process.env.COSMOS_ENDPOINT ? "connected" : "not configured",
}))

const PORT = process.env.PORT || 8080
app.listen(PORT, async () => {
  console.log(`Zones Advisory API running on :${PORT}`)
  if (process.env.COSMOS_ENDPOINT) await initDb()
  else console.log("Cosmos DB not configured - skipping DB init")
})
