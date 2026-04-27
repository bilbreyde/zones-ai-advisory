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
      agentBacklog: [],
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

// POST /api/clients/:id/agents — add agent to backlog
router.post('/:id/agents', async (req, res) => {
  try {
    console.log('Adding agent to backlog for client:', req.params.id)
    console.log('Agent data:', req.body)

    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    if (!existing.agentBacklog) existing.agentBacklog = []

    // Avoid duplicates — match by id if present, otherwise by name
    const alreadyExists = existing.agentBacklog.some(
      a => (req.body.id && a.id === req.body.id) || a.name === req.body.name
    )
    if (alreadyExists) {
      console.log('Agent already in backlog, skipping duplicate')
      return res.json(existing)
    }

    existing.agentBacklog.push({
      ...req.body,
      status: 'backlog',
      addedAt: new Date().toISOString(),
    })
    existing.updatedAt = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id)
      .replace(existing)

    console.log('Backlog saved. New length:', updated.agentBacklog.length)
    res.json(updated)
  } catch (err) {
    console.error('Error saving to backlog:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/clients/:id/agents/:agentId — update agent status
router.patch('/:id/agents/:agentId', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    const idx = (existing.agentBacklog || []).findIndex(a => a.id === req.params.agentId)
    if (idx === -1) return res.status(404).json({ error: 'Agent not found in backlog' })

    existing.agentBacklog[idx] = {
      ...existing.agentBacklog[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
    existing.updatedAt = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id)
      .replace(existing)

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/clients/:id/agents/:agentId — remove from backlog
router.delete('/:id/agents/:agentId', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    existing.agentBacklog = (existing.agentBacklog || []).filter(a => a.id !== req.params.agentId)
    existing.updatedAt = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id)
      .replace(existing)

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
