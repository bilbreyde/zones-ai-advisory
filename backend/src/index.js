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

const client = new AzureOpenAI({
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiKey:     process.env.AZURE_OPENAI_KEY,
  apiVersion: "2024-08-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
})

const SYSTEM_PROMPT = `You are the Zones AI Advisory Assistant, an expert AI governance and strategy advisor embedded in the Zones AI Advisory Framework tool. You help Zones consultants and their clients by analyzing AI maturity assessment results across 5 pillars: Governance, Risk and Compliance, AI Strategy, Operations, and Enablement. Be concise, specific, and practical. Respond in 2-4 short paragraphs maximum.`

app.use("/api/clients", clientRoutes)
app.use("/api/assessments", assessmentRoutes)
app.use("/api/sessions", sessionRoutes)

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, clientContext } = req.body
    if (!messages?.length) return res.status(400).json({ error: "messages required" })
    const contextPrompt = clientContext
      ? `\n\nCurrent client: ${clientContext.name}. Scores: ${JSON.stringify(clientContext.scores)}. Overall: ${clientContext.overallScore}/5.`
      : ""
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextPrompt },
        ...messages.slice(-10)
      ],
      temperature: 0.7,
      max_tokens: 600,
    })
    res.json({ reply: completion.choices[0].message.content })
  } catch (err) {
    console.error("Azure OpenAI error:", err.message)
    res.status(500).json({ error: "Failed to get AI response", detail: err.message })
  }
})

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  model: process.env.AZURE_OPENAI_DEPLOYMENT,
  db: process.env.COSMOS_ENDPOINT ? "connected" : "not configured"
}))

const PORT = process.env.PORT || 8080
app.listen(PORT, async () => {
  console.log(`Zones Advisory API running on :${PORT}`)
  if (process.env.COSMOS_ENDPOINT) await initDb()
  else console.log("Cosmos DB not configured - skipping DB init")
})
