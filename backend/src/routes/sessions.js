import { Router } from 'express'
import { containers } from '../db.js'

const router = Router()

router.get('/:clientId', async (req, res) => {
  try {
    const { resources } = await containers.sessions.items
      .query({
        query: 'SELECT * FROM c WHERE c.clientId = @clientId ORDER BY c.sessionNumber DESC',
        parameters: [{ name: '@clientId', value: req.params.clientId }],
      })
      .fetchAll()
    res.json(resources)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:clientId', async (req, res) => {
  try {
    const { sessionNumber, notes, advisor } = req.body
    if (!sessionNumber) return res.status(400).json({ error: 'sessionNumber required' })

    // Use a deterministic ID so repeated saves for the same session upsert cleanly
    const session = {
      id: `${req.params.clientId}-session-${sessionNumber}`,
      clientId: req.params.clientId,
      sessionNumber,
      notes: notes || '',
      advisor: advisor || '',
      updatedAt: new Date().toISOString(),
    }

    const { resource } = await containers.sessions.items.upsert(session)
    res.json(resource)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
