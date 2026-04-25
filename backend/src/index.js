import express from ''express''
import cors from ''cors''
import ''dotenv/config''
import { AzureOpenAI } from ''openai''

const app = express()
app.use(cors())
app.use(express.json())

const client = new AzureOpenAI({
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiKey:     process.env.AZURE_OPENAI_KEY,
  apiVersion: ''2024-08-01-preview'',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || ''gpt-4o'',
})

const SYSTEM_PROMPT = `You are the Zones AI Advisory Assistant â€” an expert AI governance and strategy advisor embedded in the Zones AI Advisory Framework tool.

You help Zones consultants and their clients by:
- Analyzing AI maturity assessment results across 5 pillars: Governance, Risk & Compliance, AI Strategy, Operations, and Enablement
- Providing specific, actionable recommendations based on maturity scores
- Explaining industry benchmarks and what "good" looks like at each maturity level
- Helping advisors prepare for client conversations and executive readouts
- Suggesting prioritized roadmaps and quick wins
- Answering questions about AI governance, risk management, and strategy best practices

Current client context: Acme Corp, Session 3 of 6.
Current scores: Governance 3.2/5, Risk 2.1/5, Strategy 4.0/5, Operations 2.8/5, Enablement 1.9/5.
Overall maturity: 2.8/5 (Developing stage).

Be concise, specific, and practical. Use industry frameworks (NIST AI RMF, ISO 42001, OECD AI Principles) where relevant. Respond in 2-4 short paragraphs maximum.`

app.post(''/api/chat'', async (req, res) => {
  try {
    const { messages } = req.body
    if (!messages?.length) return res.status(400).json({ error: ''messages required'' })

    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || ''gpt-4o'',
      messages: [
        { role: ''system'', content: SYSTEM_PROMPT },
        ...messages.slice(-10) // keep last 10 turns for context
      ],
      temperature: 0.7,
      max_tokens: 600,
    })

    const reply = completion.choices[0].message.content
    res.json({ reply })
  } catch (err) {
    console.error(''Azure OpenAI error:'', err.message)
    res.status(500).json({ error: ''Failed to get AI response'', detail: err.message })
  }
})

app.get(''/api/health'', (req, res) => res.json({ status: ''ok'', model: process.env.AZURE_OPENAI_DEPLOYMENT }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Zones Advisory API running on :${PORT}`))

