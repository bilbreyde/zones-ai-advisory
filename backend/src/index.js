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

VISUAL RESPONSES: When the user asks about plans, roadmaps, timelines, priorities, recommendations, improvement steps, phases, quick wins, checklists, or benchmarks, respond ONLY with a raw JSON object — no markdown, no code fences, no explanation outside the JSON:
{"text":"1–2 sentence intro","visual":{"type":"...","title":"...","..."}}

Visual type schemas (pick the best fit):

gantt — phased plans, 90-day programs:
{"type":"gantt","title":"...","phases":[{"name":"Phase 1 — Name","days":"1–30","color":"#E8A838","tasks":["task 1","task 2","task 3"]},{"name":"Phase 2 — Name","days":"31–60","color":"#4A9FE0","tasks":["..."]},{"name":"Phase 3 — Name","days":"61–90","color":"#3DBA7E","tasks":["..."]}]}

priority_matrix — prioritization, quick wins analysis:
{"type":"priority_matrix","title":"...","items":[{"label":"concise item label","quadrant":"quick_win"}]}
quadrant must be exactly one of: quick_win | strategic | fill_in | thankless
Use 6–10 items spread across quadrants.

timeline — roadmaps, milestone sequences:
{"type":"timeline","title":"...","milestones":[{"date":"Week 1–2","label":"Milestone name","color":"#4A9FE0","description":"one sentence"}]}

scorecard — benchmark comparisons, score tables:
{"type":"scorecard","title":"...","rows":[{"label":"Governance","client":3.2,"benchmark":3.5}]}
Include all 5 pillars. Use realistic industry benchmarks (2.8–3.8 range).

checklist — action item lists, quick wins checklists:
{"type":"checklist","title":"...","categories":[{"name":"Category","color":"#EC4899","items":["action 1","action 2","action 3"]}]}

For all other questions — gap analysis, explanations, general advice, greetings — respond with plain text only (2–4 short paragraphs). Never wrap plain text in JSON.`

app.use("/api/clients", clientRoutes)
app.use("/api/assessments", assessmentRoutes)
app.use("/api/sessions", sessionRoutes)

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, clientContext, format } = req.body
    if (!messages?.length) return res.status(400).json({ error: "messages required" })

    const contextPrompt = clientContext
      ? `\n\nCurrent client: ${clientContext.name}. Pillar scores: ${JSON.stringify(clientContext.scores)}. Overall: ${clientContext.overallScore ?? "not yet assessed"}/5.`
      : ""

    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const rawContent = completion.choices[0].message.content.trim()
    let reply = rawContent
    let visual = null

    // Parse visual envelope unless caller requested plain text (e.g. narrative card)
    if (format !== "text") {
      try {
        // Strip markdown code fences GPT sometimes adds despite instructions
        const stripped = rawContent
          .replace(/```(?:json)?\s*/gi, "")
          .replace(/```/g, "")
          .trim()
        // Extract first valid JSON object — handles extra text before/after the JSON block
        const jsonStart = stripped.indexOf("{")
        const jsonEnd   = stripped.lastIndexOf("}")
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1))
          if (parsed.text !== undefined) {
            reply  = parsed.text
            visual = parsed.visual || null
          }
        }
      } catch {
        // Not JSON — use raw text as-is
      }
    }

    res.json({ reply, visual })
  } catch (err) {
    console.error("Azure OpenAI error:", err.message)
    res.status(500).json({ error: "Failed to get AI response", detail: err.message })
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
