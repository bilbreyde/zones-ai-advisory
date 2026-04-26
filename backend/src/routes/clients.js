import { Router } from 'express'
import { containers } from '../db.js'
import { v4 as uuid } from 'uuid'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { resources } = await containers.clients.items
      .query('SELECT * FROM c ORDER BY c.createdAt DESC')
      .fetchAll()
    res.json(resources)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { resource } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!resource) return res.status(404).json({ error: 'Client not found' })
    res.json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const client = {
      id: uuid(),
      name: req.body.name,
      industry: req.body.industry || '',
      advisor: req.body.advisor || '',
      size: req.body.size || '',
      status: 'Kickoff',
      currentSession: 1,
      scores: { governance: null, risk: null, strategy: null, operations: null, enablement: null },
      overallScore: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const { resource } = await containers.clients.items.create(client)
    res.status(201).json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }
    const { resource } = await containers.clients.item(req.params.id, req.params.id).replace(updated)
    res.json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Agent backlog — push an agent to client.agentBacklog[]
router.post('/:id/agents', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })
    const entry = { ...req.body, status: 'backlog', addedAt: new Date().toISOString() }
    const agentBacklog = [...(existing.agentBacklog || []), entry]
    const { resource } = await containers.clients.item(req.params.id, req.params.id).replace({
      ...existing, agentBacklog, updatedAt: new Date().toISOString(),
    })
    res.json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
