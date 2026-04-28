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

6. WHEN GENERATING VISUALS — content must be specific to this client
   The client's actual tool names and scores must appear inside every visual:
   - Gantt tasks must reference their actual tools (e.g. "Configure ServiceNow → Dynamics 365 API connector" not "Set up integration")
   - RACI activities must name specific integrations or systems, not generic categories (e.g. "Dynamics 365 + SQL Server approval workflow" not "Data governance")
   - Priority matrices must list their actual named initiatives with effort/team (e.g. "Azure Arc deployment to bridge Dynamics 365 cloud and SQL Server on-prem (8 weeks, IT team)")
   - Checklists must reference specific systems (e.g. "Export Databricks lineage report to SharePoint" not "Document data flows")
   - Timelines must use realistic week estimates based on their overall score (score ≤2: add 50% to estimates; score ≥4: compress by 25%)
   BAD: "Audit data flows across agents" | GOOD: "Map ServiceNow ↔ Dynamics 365 data flows (IT Lead, 3 days)"
   BAD: "Azure Arc deployment" | GOOD: "Azure Arc deployment to bridge Dynamics 365 cloud + SQL Server on-prem (8 wks)"

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
  if (!raw || typeof raw !== 'string') {
    return { text: '', visual: null, visuals: [], agents: [] }
  }

  // Clean markdown fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  const firstBrace   = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')

  // No JSON found — return as plain text
  if (firstBrace === -1 && firstBracket === -1) {
    return { text: raw, visual: null, visuals: [], agents: [] }
  }

  // Split any plain text that precedes the JSON
  let plainText = ''
  let jsonStr   = cleaned

  if (firstBrace > 20) {
    plainText = cleaned.slice(0, firstBrace).trim()
    jsonStr   = cleaned.slice(firstBrace)
  } else if (firstBrace !== -1) {
    jsonStr = cleaned.slice(firstBrace)
  }

  // Find closing brace; attempt bracket recovery if truncated
  const lastBrace = jsonStr.lastIndexOf('}')
  if (lastBrace === -1) {
    console.warn('[extract] JSON truncated, attempting bracket recovery')
    let opens = 0, arrOpens = 0
    for (const ch of jsonStr) {
      if (ch === '{') opens++
      else if (ch === '}') opens--
      else if (ch === '[') arrOpens++
      else if (ch === ']') arrOpens--
    }
    jsonStr += ']'.repeat(Math.max(0, arrOpens))
    jsonStr += '}'.repeat(Math.max(0, opens))
  } else {
    jsonStr = jsonStr.slice(0, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr)

    // Case 1 — Strategic envelope { text, visuals: [...] }
    if (parsed.visuals && Array.isArray(parsed.visuals) && parsed.visuals.length > 0) {
      const summaryText = parsed.text || parsed.reply || plainText || ''
      console.log(`[extract] multi-visual: ${parsed.visuals.length} visuals, summary: "${summaryText.slice(0, 60)}"`)
      return { text: summaryText, visual: null, visuals: parsed.visuals, agents: [] }
    }

    // Case 2 — Single visual envelope { text/reply, visual: {...} }
    if (parsed.visual?.type) {
      const summaryText = parsed.text || parsed.reply || plainText || ''
      console.log(`[extract] single visual: ${parsed.visual.type}`)
      return { text: summaryText, visual: parsed.visual, visuals: [parsed.visual], agents: [] }
    }

    // Case 3 — Bare visual (the JSON IS the visual)
    if (parsed.type && VISUAL_TYPES.has(parsed.type)) {
      console.log(`[extract] bare visual: ${parsed.type}`)
      return { text: plainText || '', visual: parsed, visuals: [parsed], agents: [] }
    }

    // Case 4 — Agent discover response { agents: [...] }
    if (parsed.agents && Array.isArray(parsed.agents)) {
      return { text: parsed.text || parsed.reply || plainText || '', visual: null, visuals: [], agents: parsed.agents }
    }

    // Case 5 — Parsed JSON but no recognised structure — never dump raw JSON as text
    const textContent = parsed.text || parsed.reply || plainText
    if (textContent) {
      console.warn('[extract] no visual structure — returning text content only')
      return { text: textContent, visual: null, visuals: [], agents: [] }
    }

    console.warn('[extract] no visual found in parsed JSON, keys:', Object.keys(parsed).join(', '))
    return { text: 'Response generated successfully.', visual: null, visuals: [], agents: [] }

  } catch (e) {
    console.error('[extract] JSON parse failed:', e.message)
    console.error('[extract] attempted (first 200):', jsonStr.slice(0, 200))
    // Return plain text if it exists, otherwise a safe fallback — never raw JSON
    if (plainText) return { text: plainText, visual: null, visuals: [], agents: [] }
    return { text: 'The response was generated but could not be fully parsed. Please try again.', visual: null, visuals: [], agents: [] }
  }
}

function isStrategicQuestion(message) {
  const strategic = [
    'plan', 'strategy', 'roadmap', 'remove', 'fix', 'solve', 'improve',
    'how do we', 'how can we', 'how should we', 'what should we do',
    'agentic wall', 'agentic walls', 'integration', 'architecture',
    'detailed', 'comprehensive', 'step by step', 'step-by-step',
    'full plan', 'execution', 'implement', 'transform', 'modernize',
    'migrate', 'consolidate', 'unify', 'bridge', 'create a plan',
    'build a plan', 'develop a plan', 'give me a plan',
    'operating model', 'multi-agent', 'orchestration', 'agent design',
    'agent architecture', 'enablement plan', 'governance model',
    'maturity improvement', 'sow', 'statement of work', 'proposal'
  ]
  const lower = message.toLowerCase()
  return strategic.some(phrase => lower.includes(phrase))
}

function validateVisualSpecificity(visual, clientContext) {
  if (!visual || !clientContext) return true
  const tools = [
    ...(clientContext.environmentProfile?.cloudTools  || []),
    ...(clientContext.environmentProfile?.onPremTools || []),
  ]
  if (!tools.length) return true
  const visualStr = JSON.stringify(visual).toLowerCase()
  const hasClientData = tools.some(t => visualStr.includes(t.toLowerCase()))
    || visualStr.includes((clientContext.name || '').toLowerCase())
    || Object.keys(clientContext.scores || {}).some(p => visualStr.includes(p))
  if (!hasClientData) console.warn("[chat] visual may be too generic — no client tools referenced")
  return true // log only; never block
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

    // Compute lowest and highest scoring pillars for context injection
    const { lowestPillar, highestPillar } = (() => {
      const s = clientContext?.scores || {}
      const valid = Object.entries(s).filter(([, v]) => v !== null && v !== undefined)
      if (!valid.length) return { lowestPillar: 'Not assessed', highestPillar: 'Not assessed' }
      const sorted = valid.sort(([, a], [, b]) => a - b)
      const [lp, ls] = sorted[0]
      const [hp, hs] = sorted[sorted.length - 1]
      return { lowestPillar: `${lp} (${ls}/5)`, highestPillar: `${hp} (${hs}/5)` }
    })()

    // Inject client tools directly into visual generation hint
    const allClientTools = [...(ep.cloudTools || []), ...(ep.onPremTools || [])].slice(0, 10)
    const visualHint = allClientTools.length > 0 ? `
VISUAL GENERATION — when creating any Gantt, RACI, checklist, or priority matrix:
- Every task/activity MUST reference at least one of their actual tools: ${allClientTools.join(', ')}
- Use their overall score (${clientContext.overallScore ?? '?'}/5) to calibrate timelines: score ≤2.5 = add 50% to estimates; score ≥4 = compress by 25%
- Week estimates for a ${clientContext.industry || 'Technology'} company at ${clientContext.overallScore ?? '?'}/5: Quick wins 1-2 wks, Medium 4-8 wks, Complex 12-20 wks
- Name real roles from ${clientContext.industry || 'Technology'} (e.g. "IT Lead", "Data Engineer", "Risk Officer"), not "Stakeholder"` : ''

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
${visualHint}
---
You MUST reference this client's specific scores, tools, and deployment model in your response. Do not give generic advice that could apply to any client.`
    : `
---
NO CLIENT SELECTED — you have no client context.
State clearly that your response is generic. Recommend selecting a client for specific advice.
Do not fabricate client data.
---`

    // Strategic question detection
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
    const isStrategic = isStrategicQuestion(lastUserMessage)

    // Pre-compute multi-cloud flag for strategic instruction
    const hasMultiCloud = (ep.cloudTools || []).some(t => ['AWS', 'AWS Bedrock', 'GCP', 'Google Vertex AI'].includes(t))
    const allClientTools12 = [...(ep.cloudTools || []), ...(ep.onPremTools || [])].slice(0, 12)
    const complianceStr = complianceList.join(', ') || 'standard governance'

    // Pre-compute multi-cloud tools list for strategic instruction
    const multiCloudTools = (ep.cloudTools || []).filter(t => ['Azure', 'Azure AI Foundry', 'Azure OpenAI', 'AWS', 'AWS Bedrock', 'GCP', 'Google Vertex AI'].includes(t)).join(', ')
    const agentStackTools = (ep.cloudTools || []).filter(t => ['Azure', 'Azure AI Foundry', 'Azure OpenAI', 'ServiceNow', 'Dynamics 365', 'GitHub', 'Microsoft Fabric', 'Microsoft Sentinel', 'Databricks'].includes(t)).join(', ')
    const enablementScore = clientContext?.scores?.enablement ?? '?'
    const shadowLikelihood = clientContext?.scores?.enablement != null && clientContext.scores.enablement <= 2.5 ? 5 : 4

    const strategicInstruction = isStrategic ? `

STRATEGIC QUESTION DETECTED — produce a comprehensive consulting deliverable.

The question is: "${lastUserMessage.slice(0, 150)}"

CRITICAL DISTINCTION — read before generating:
If the question involves agents, agentic systems, or multi-agent topics:
- Integration architecture answers "how do systems connect?" — DO NOT produce this
- Agent architecture answers "how do agents think, remember, coordinate, and act?" — PRODUCE THIS
- You must show multi-agent BEHAVIOR, not just multi-agent COMPONENTS

Return ONLY a raw JSON object. Start with { end with }. No markdown. No fences.

{"text":"2-3 sentence executive summary naming the client, the specific business problem, the Zones engagement model, and estimated engagement value range based on their size and maturity.","visuals":[VISUAL_1,VISUAL_2,VISUAL_3,VISUAL_4,VISUAL_5,VISUAL_6,VISUAL_7,VISUAL_8]}

MANDATORY 8 VISUALS — include ALL:

VISUAL 1 — PROBLEM DIAGNOSIS (type: "mermaid")
Title: "[Client Name] Agentic Wall Analysis"
Map WHERE walls exist using their actual named systems: ${allClientTools12.join(', ')}
Label each broken connection with wall TYPE:
- "Data wall" — systems don't share data
- "Identity wall" — auth doesn't cross systems
- "Platform wall" — agents locked to one vendor
- "Process wall" — workflows can't span systems
- "Memory wall" — no shared context between agents
Use ✗ on broken connections. Use subgraph to group related systems. Max 10 nodes.

VISUAL 2 — MULTI-AGENT COORDINATION MODEL (type: "mermaid") — MOST IMPORTANT VISUAL
Title: "Multi-Agent Coordination Architecture"
This MUST show HOW AGENTS BEHAVE TOGETHER, not just what components exist.
Show these specific patterns:
1. SUPERVISOR AGENT PATTERN: Orchestrator Agent (Semantic Kernel) receives task → breaks into subtasks → delegates to specialist agents → collects results → synthesizes response
2. PLANNER/EXECUTOR SPLIT: Planner Agent reasons about what needs to happen → Executor Agents carry out specific actions (one per system)
3. SHARED MEMORY MODEL: All agents read/write to shared vector memory (Azure Cognitive Search) + working memory in Redis Cache (transient) + long-term memory in Fabric (durable)
4. EVENT-DRIVEN COORDINATION: Azure Event Grid triggers agents based on system events → agents publish results as events → no direct agent-to-agent calls — all via event bus
5. HUMAN-IN-THE-LOOP GATES: Show where agents pause for human approval before proceeding (critical for ${complianceStr})
Use their actual agent-relevant tools: ${agentStackTools || allClientTools12.slice(0, 6)}
Chart must show agent communication FLOWS, not just system boxes.
Example: "Orchestrator Agent" → delegates → "Incident Analyzer Agent" → reads → "SQL Server logs via Fabric" → writes → "Azure DevOps ticket" → notifies → "ServiceNow auto-close"

VISUAL 3 — TARGET AGENT SYSTEM ARCHITECTURE (type: "mermaid")
Title: "Target Agent System Architecture"
Show LAYERED ARCHITECTURE with ALL these layers:
- Agent Orchestration Layer: Semantic Kernel / Azure AI Foundry (orchestrates all agents)
- Tool & Skill Registry: capabilities agents can invoke (name their specific APIs: ServiceNow, DevOps, Dynamics APIs)
- Memory Layer: Azure Cognitive Search (semantic/vector), Redis Cache (working), Fabric (long-term)
- Planning & Execution Loop: Task decomposition → agent selection → execution → result synthesis
- Data Abstraction Layer: Unified API gateway over all their systems
- Identity & Policy Layer: Entra ID + ${complianceStr}
- Observability Layer: Microsoft Sentinel + Azure Monitor (all agent actions logged)

VISUAL 4 — AGENT OPERATING MODEL (type: "raci_matrix")
Title: "Agent Operating Model — Lifecycle & Ownership"
CRITICAL given their Enablement score of ${enablementScore}/5.
Rows (lifecycle activities):
- Agent design & architecture review
- Agent build & testing
- Agent deployment & release
- Agent monitoring & alerting
- New agent request & approval
- Compliance & audit review
- Training & enablement delivery
- Incident response & agent rollback
- Agent retirement & versioning
Roles for ${clientContext?.industry || 'Technology'}: CIO/CTO, AI Platform Team, Business Unit Owner, Risk & Compliance, IT Operations
Include in narrative field — AGENT TYPES with clear ownership:
- Orchestrator agents (owned by AI Platform Team)
- Task/executor agents (owned by Business Unit)
- Data agents (owned by IT Operations under AI Platform oversight)
- Governance agents (owned by Risk & Compliance)

VISUAL 5 — ENABLEMENT ENGINE (type: "checklist") — LARGEST SECTION given Enablement score ${enablementScore}/5
Title: "AI Enablement Engine — Closing the ${enablementScore}/5 Gap"
Enablement is their LOWEST pillar — this MUST be the most detailed section with 4 complete categories:

CATEGORY 1 — TRAINING CURRICULUM:
- Agent design patterns course for developers (Semantic Kernel, LangGraph fundamentals) — 2 weeks, mandatory for AI Platform Team
- AI literacy program for business users: what agents can/cannot do, how to request agents — 1 week, all business units
- Agent governance training for Risk & Compliance: audit requirements, ${complianceStr} agent compliance — 1 week
- Executive AI briefing: ROI framework, decision rights, investment approval — half-day

CATEGORY 2 — AGENT DESIGN PATTERNS LIBRARY:
- Reusable agent templates for common workflows (incident response, data extraction, report generation) using their tools
- Integration connector library for their specific systems (${(ep.cloudTools || []).slice(0, 5).join(', ')})
- Testing & validation framework for agents before production deployment
- Prompt engineering guidelines with ${complianceStr} guardrails

CATEGORY 3 — INTERNAL AGENT MARKETPLACE:
- Internal catalog of approved, production-ready agents
- Request workflow: Business Unit submits → AI Platform reviews → Risk approves → Deploy
- Agent versioning and rollback procedures
- Usage analytics and ROI tracking per agent

CATEGORY 4 — GOVERNANCE GUARDRAILS (critical given ${enablementScore}/5 Enablement — shadow AI is the biggest risk):
- Shadow AI detection and remediation policy
- Approved model list and update cadence
- Data classification rules for agent access
- Mandatory audit logging checklist for every agent (required for ${complianceStr})

VISUAL 6 — 90-DAY EXECUTION PLAN (type: "gantt")
Title: "90-Day Execution Plan"
Sequence MUST start with lowest gap, leverage highest strength:
- LOWEST — ${lowestPillar} — start here
- HIGHEST — ${highestPillar} — leverage this

Phase 1 (Days 1-30) — Foundation & Enablement First:
Each task format: "[WHO] does [WHAT] ([HOW LONG]) → Output: [DELIVERABLE]"
Must include: at least one enablement task (lowest pillar) + at least one specific agent prototype task
Example: "AI Platform Team: build ServiceNow→Azure OpenAI→DevOps incident agent prototype (2 weeks) → Output: working demo with 40% MTTR improvement measured"

Phase 2 (Days 31-60) — First Production Agents:
Name SPECIFIC agents going to production using actual tool names
Include measurable business outcome for each agent (specific KPI)
Include compliance checkpoint: ${complianceStr} audit log validation (Risk Officer, 1 week)

Phase 3 (Days 61-90) — Scale, Govern & Productize:
- Agent marketplace launch
- Enablement rollout to all business units
- Zones managed services handoff preparation
- Executive ROI readout with measured outcomes vs. targets

VISUAL 7 — MULTI-CLOUD AI STRATEGY (type: "mermaid")
Title: "${hasMultiCloud ? 'Multi-Cloud AI Model Routing Strategy' : 'AI Service Architecture & Tiering'}"
${hasMultiCloud ? `MANDATORY — client has multi-cloud environment: ${multiCloudTools}

Show ALL these layers in the Mermaid chart:

Layer 1 — AGENT REQUEST LAYER (top): All agents submit to a central Model Router — never call models directly

Layer 2 — MODEL ROUTING LAYER: Intelligent routing rules:
- Complex reasoning (root cause analysis, strategic recommendations) → Azure OpenAI GPT-4o
- High-volume classification (document tagging, sentiment, intent) → Azure OpenAI GPT-4o-mini OR AWS Bedrock Claude 3 Haiku (cost optimization: 60-80% cheaper)
- Code generation & technical analysis → Azure OpenAI or GitHub Copilot API
- Multimodal tasks (image + text) → Azure OpenAI GPT-4o Vision or Google Vertex AI Gemini
- Privacy-sensitive tasks (${complianceStr}) → private model via Azure Arc

Layer 3 — COST OPTIMIZATION: Premium GPT-4o for complex reasoning + Standard tier for classification = 40-60% cost reduction vs GPT-4o-only

Layer 4 — FALLBACK & RESILIENCE: Azure OpenAI down → AWS Bedrock → Azure Arc private model

Layer 5 — DATA RESIDENCY: ${complianceList.includes('gdpr') ? 'GDPR: EU data stays in EU regions (Azure EU West / AWS EU)' : ''} ${complianceList.includes('fedramp') ? 'FedRAMP: Azure Government or AWS GovCloud only' : ''} SOC 2/ISO 27001: all model API calls logged via Microsoft Sentinel` : `Client is primarily single-cloud. Show Azure AI service tiering:
- Premium: Azure OpenAI GPT-4o (complex reasoning, strategic recommendations)
- Standard: Azure OpenAI GPT-4o-mini (classification, extraction, high-volume tasks) — 80% cheaper
- Monitoring: Microsoft Sentinel + Azure Monitor for all model calls
- Cost optimization: intelligent routing between tiers based on task complexity
- Fallback: Azure Arc private model deployment for compliance-sensitive tasks`}

VISUAL 8 — FINANCIAL MODEL & ROI (type: "scorecard")
Title: "Investment & ROI Framework"
Calibrate ALL numbers to company size (${clientContext?.size || 'mid-market'}) and maturity score (${clientContext?.overallScore ?? '?'}/5). Lower maturity = higher cost, longer payback.
rows array with label, client (their specific estimate as string), benchmark (industry average as string):
Build costs:
- {"label":"Phase 1 investment (foundation + 1 agent)","client":"$45K-$65K","benchmark":"Industry avg: $50K-$80K"}
- {"label":"Phase 2-3 investment (3-5 agents + governance)","client":"$80K-$120K","benchmark":"Industry avg: $90K-$150K"}
- {"label":"Total 90-day program","client":"$125K-$185K","benchmark":"Industry avg: $140K-$230K"}
- {"label":"Ongoing managed service (monthly)","client":"$12K-$18K/mo","benchmark":"Industry avg: $15K-$25K/mo"}
Estimated returns:
- {"label":"Incident Resolution Agent: MTTR reduction","client":"40% reduction = ~$180K/yr saved","benchmark":"Typical: 30-50%"}
- {"label":"Compliance Monitoring Agent: audit cost reduction","client":"~$60K/yr saved","benchmark":"Typical: $40K-$80K/yr"}
- {"label":"Automation rate across 5 agents","client":"~35% of routine workflows","benchmark":"Typical: 25-45%"}
- {"label":"Estimated payback period","client":"8-14 months","benchmark":"Industry avg: 9-18 months"}
- {"label":"3-year ROI","client":"180-240%","benchmark":"Industry avg: 150-200%"}
Zones opportunity:
- {"label":"90-day AI Integration SOW","client":"$125K-$185K","benchmark":""}
- {"label":"Agent Factory managed service (12 months)","client":"$144K-$216K ARR","benchmark":""}
- {"label":"Total first-year Zones opportunity","client":"$270K-$400K","benchmark":""}

AGENT RISKS — add as a 9th visual (type: "risk_heatmap", title: "Agent Design Risk Profile") if token budget allows. Agent-specific risks only: prompt injection (4,5), tool misuse (3,4), agent runaway (3,4), cross-system data leakage (4,5), context poisoning (2,4), hallucinated tool calls (3,3), shadow agents (${shadowLikelihood},4 — elevated given Enablement ${enablementScore}/5)${complianceList.includes('soc2') || complianceList.includes('iso27001') ? ', compliance audit gap (3,5)' : ''}

RESPONSE RULES:
1. All 8 visuals mandatory — do not skip any
2. Visual 2 (multi-agent coordination) is the most differentiating — make it thorough with all 5 patterns
3. Visual 5 (enablement) must be the most detailed section — 4 full categories with specific items
4. Visual 8 (financial model) must include real dollar estimates calibrated to their size
5. Every visual must reference their actual named tools — no generic system names
6. Return ONLY raw JSON — start with { end with }
7. Each visual MUST include a "narrative" object (headline, context, actions[]) BEFORE the type field
8. If truncation risk: complete each visual fully before starting the next — do not truncate mid-visual` : ''

    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:    [
        { role: "system", content: SYSTEM_PROMPT + clientSection + strategicInstruction },
        ...messages.slice(-10),
      ],
      temperature: isStrategic ? 0.4 : 0.6,
      max_tokens:  isStrategic ? 8000 : 1500,
    })

    const raw = completion.choices[0].message.content
    console.log('[chat] raw response length:', raw.length)
    console.log('[chat] raw starts with:', raw.slice(0, 80))

    const parsed = extractVisualFromResponse(raw)
    console.log('[chat] parsed — text length:', parsed.text?.length, '| visuals:', parsed.visuals?.length)
    validateVisualSpecificity(parsed.visual || parsed.visuals?.[0], clientContext)

    const showAgentStudio = /\b(agent|automate|automation|workflow|orchestrat)\b/i.test(raw)

    res.json({
      reply:          parsed.text || '',
      visual:         parsed.visual || null,
      visuals:        parsed.visuals?.length ? parsed.visuals : null,
      showAgentStudio,
    })
  } catch (err) {
    console.error('Chat error:', err.message, err.stack)
    res.status(500).json({ error: 'Failed to get AI response', detail: err.message })
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
