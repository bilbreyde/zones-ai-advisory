import { Router } from 'express'
import { containers } from './db.js'
import { v4 as uuid } from 'uuid'

const router = Router()

const SCORE_MAP = { 'Not started': 1, 'In progress': 2, 'Implemented': 3, 'Optimized': 5 }

function calcPillarScore(answers) {
  const vals = Object.values(answers).filter(Boolean)
  if (!vals.length) return null
  const scores = vals.map(v => SCORE_MAP[v] || 0)
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

// GET assessment for a client
router.get('/:clientId', async (req, res) => {
  try {
    const { resources } = await containers.assessments.items
      .query({ query: 'SELECT * FROM c WHERE c.clientId = @clientId', parameters: [{ name: '@clientId', value: req.params.clientId }] })
      .fetchAll()
    res.json(resources[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST save answer
router.post('/:clientId/answer', async (req, res) => {
  try {
    const { pillar, questionId, answer } = req.body
    const { resources } = await containers.assessments.items
      .query({ query: 'SELECT * FROM c WHERE c.clientId = @clientId', parameters: [{ name: '@clientId', value: req.params.clientId }] })
      .fetchAll()

    let assessment = resources[0]

    if (!assessment) {
      assessment = {
        id: uuid(),
        clientId: req.params.clientId,
        answers: { governance: {}, risk: {}, strategy: {}, operations: {}, enablement: {} },
        scores: {},
        overallScore: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    // Save answer
    assessment.answers[pillar][questionId] = answer
    assessment.updatedAt = new Date().toISOString()

    // Recalculate scores
    const pillars = ['governance', 'risk', 'strategy', 'operations', 'enablement']
    for (const p of pillars) {
      assessment.scores[p] = calcPillarScore(assessment.answers[p])
    }

    const validScores = pillars.map(p => assessment.scores[p]).filter(Boolean)
    assessment.overallScore = validScores.length
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : null

    // Upsert
    const { resource } = await containers.assessments.items.upsert(assessment)

    // Update client scores too
    try {
      const { resource: client } = await containers.clients.item(req.params.clientId, req.params.clientId).read()
      if (client) {
        client.scores = assessment.scores
        client.overallScore = assessment.overallScore
        client.updatedAt = new Date().toISOString()
        await containers.clients.item(req.params.clientId, req.params.clientId).replace(client)
      }
    } catch {}

    res.json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
