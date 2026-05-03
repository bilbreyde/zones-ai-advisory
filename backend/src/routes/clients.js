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

// PATCH /api/clients/:id/studio-config — persist vertical + tools + focus areas
router.patch('/:id/studio-config', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients.item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    existing.studioConfig = {
      vertical:    req.body.vertical    ?? existing.studioConfig?.vertical    ?? '',
      tools:       req.body.tools       ?? existing.studioConfig?.tools       ?? [],
      focusAreas:  req.body.focusAreas  ?? existing.studioConfig?.focusAreas  ?? [],
      updatedAt:   new Date().toISOString(),
    }
    existing.updatedAt = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id)
      .replace(existing)

    res.json(updated)
  } catch (err) {
    console.error('Error saving studio config:', err.message)
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

// PATCH /api/clients/:id/environment — persist unified environment profile
router.patch('/:id/environment', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    existing.environmentProfile = {
      deploymentModel:      req.body.deploymentModel || 'cloud_native',
      cloudTools:           req.body.cloudTools || [],
      cloudToolCategoryMap: req.body.cloudToolCategoryMap || {},
      onPremTools:          req.body.onPremTools || [],
      onPremCategoryMap:    req.body.onPremCategoryMap || {},
      legacySystems:        req.body.legacySystems || [],
      legacyCategoryMap:    req.body.legacyCategoryMap || {},
      complianceFrameworks: req.body.complianceFrameworks || [],
      constraints:          req.body.constraints || [],
      vertical:             req.body.vertical || '',
      completedAt:          existing.environmentProfile?.completedAt || new Date().toISOString(),
      updatedAt:            new Date().toISOString(),
    }

    if (req.body.vertical) existing.industry = req.body.vertical

    existing.studioConfig = {
      ...existing.studioConfig,
      ...existing.environmentProfile,
      tools:           req.body.cloudTools || [],
      toolCategoryMap: req.body.cloudToolCategoryMap || {},
    }

    existing.updatedAt = new Date().toISOString()
    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(existing)
    res.json(updated)
  } catch (err) {
    console.error('Error saving environment profile:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clients/:id/meeting-notes — extract profile changes from notes
router.post('/:id/meeting-notes', async (req, res) => {
  try {
    const { resource: client } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const { notes, participants, meetingDate } = req.body
    if (!notes?.trim()) return res.status(400).json({ error: 'notes required' })

    const ASSESSMENT_QUESTIONS = `
GOVERNANCE: g1) documented AI governance policy, g2) dedicated AI governance committee, g3) formal AI initiative approval process, g4) defined roles for AI oversight, g5) AI governance in IT governance framework, g6) AI governance policy for legacy systems
RISK: r1) documented AI data usage and retention policies, r2) process for monitoring AI model outputs for bias or drift, r3) AI risks in enterprise risk register, r4) security assessments on AI systems, r5) regulatory compliance review for AI, r6) AI incident response plan, r7) third-party AI vendor risk assessments, r8) employee reporting of AI concerns, r9) AI systems auditable under compliance framework, r10) data classification policy for AI
STRATEGY: s1) documented AI strategy aligned to business goals, s2) AI investments prioritised by business value, s3) executive sponsorship for AI, s4) AI roadmap with milestones and KPIs, s5) AI capability building in workforce planning, s6) benchmark AI maturity against peers
OPERATIONS: o1) standardised processes for AI model deployment, o2) model registry, o3) AI systems monitored in production, o4) automated testing for AI, o5) defined MLOps practice, o6) data pipelines documented, o7) process for deploying AI to on-premises, o8) on-premises infrastructure sized for AI, o9) data movement process cloud to on-prem, o10) local LLM hosting, o11) model updates without internet
ENABLEMENT: e1) AI literacy training access, e2) center of excellence or AI community, e3) AI tools available to business users, e4) measure AI adoption rates, e5) change management in AI projects, e6) on-prem teams have relevant AI training`

    const MATURITY_LEVELS = `Score mapping: "Not started"=1, "In progress"=2, "Implemented"=3, "Optimized"=5
Rules: Only move answers FORWARD (never downgrade). "deployed/implemented/launched"→Implemented. "started/working on/in progress"→In progress. "continuously improving/benchmarking for years"→Optimized. Never assign Optimized without clear evidence of sustained excellence.`

    const extractionPrompt = `You are analysing meeting notes from a client advisory session to extract structured updates to the client's AI maturity profile.

Client: ${client.name}
Industry: ${client.industry || 'Unknown'}
Current deployment model: ${client.environmentProfile?.deploymentModel || 'unknown'}
Current tools: ${client.environmentProfile?.cloudTools?.join(', ') || 'Unknown'}
Current compliance: ${client.environmentProfile?.complianceFrameworks?.join(', ') || 'None'}
Current legacy systems: ${client.environmentProfile?.legacySystems?.join(', ') || 'None'}

ASSESSMENT QUESTION REFERENCE:
${ASSESSMENT_QUESTIONS}

MATURITY SCORING RULES:
${MATURITY_LEVELS}

MEETING NOTES:
${notes}

Extract ALL meaningful updates. For each proposed change include the EXACT quote from the notes as evidence. Be conservative — only propose changes clearly supported by the text.

Return ONLY a raw JSON object:
{
  "summary": "2-3 sentence summary of the meeting",
  "profileChanges": [
    {
      "type": "tool_add|tool_remove|compliance_add|compliance_remove|deployment_change|legacy_add|legacy_remove|constraint_add",
      "field": "field name",
      "currentValue": "current value or null",
      "proposedValue": "new value",
      "evidence": "exact quote from notes",
      "confidence": "high|medium|low",
      "reason": "brief explanation"
    }
  ],
  "assessmentChanges": [
    {
      "pillar": "governance|risk|strategy|operations|enablement",
      "questionId": "g1|r1|s1|o1|e1 etc",
      "questionText": "the question text",
      "currentAnswer": "current answer or null",
      "proposedAnswer": "Not started|In progress|Implemented|Optimized",
      "evidence": "exact quote from notes",
      "confidence": "high|medium|low",
      "reason": "why this maps to this answer"
    }
  ],
  "sessionNotes": "key points, decisions, and action items worth preserving"
}`

    const { AzureOpenAI } = await import('openai')
    const aiClient = new AzureOpenAI({
      endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
      apiKey:     process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-08-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    })

    const completion = await aiClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.2,
      max_tokens: 3000,
    })

    const raw = completion.choices[0].message.content
    let extracted
    try {
      const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const first = clean.indexOf('{')
      const last  = clean.lastIndexOf('}')
      extracted = JSON.parse(clean.slice(first, last + 1))
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI extraction response', raw })
    }

    const sessionRecord = {
      id:                      `session-${Date.now()}`,
      clientId:                req.params.id,
      meetingDate:             meetingDate || new Date().toISOString(),
      participants:            participants || [],
      rawNotes:                notes,
      extractedSummary:        extracted.summary,
      proposedProfileChanges:  extracted.profileChanges || [],
      proposedAssessmentChanges: extracted.assessmentChanges || [],
      sessionNotes:            extracted.sessionNotes,
      status:                  'pending_review',
      createdAt:               new Date().toISOString(),
    }

    if (!client.sessionHistory) client.sessionHistory = []
    client.sessionHistory.unshift(sessionRecord)
    client.updatedAt = new Date().toISOString()

    await containers.clients.item(req.params.id, req.params.id).replace(client)

    res.json({ sessionId: sessionRecord.id, extracted, sessionRecord })
  } catch (err) {
    console.error('Meeting notes error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clients/:id/apply-changes — apply confirmed changes
router.post('/:id/apply-changes', async (req, res) => {
  try {
    const { resource: client } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const { sessionId, confirmedProfileChanges, confirmedAssessmentChanges, sessionNotes } = req.body

    // Apply profile changes
    const env = client.environmentProfile || {}
    for (const change of (confirmedProfileChanges || [])) {
      if (change.type === 'tool_add')          env.cloudTools           = [...new Set([...(env.cloudTools           || []), change.proposedValue])]
      if (change.type === 'tool_remove')        env.cloudTools           = (env.cloudTools           || []).filter(t => t !== change.currentValue)
      if (change.type === 'compliance_add')     env.complianceFrameworks = [...new Set([...(env.complianceFrameworks || []), change.proposedValue])]
      if (change.type === 'compliance_remove')  env.complianceFrameworks = (env.complianceFrameworks || []).filter(f => f !== change.currentValue)
      if (change.type === 'legacy_add')         env.legacySystems        = [...new Set([...(env.legacySystems        || []), change.proposedValue])]
      if (change.type === 'legacy_remove')      env.legacySystems        = (env.legacySystems        || []).filter(s => s !== change.currentValue)
      if (change.type === 'deployment_change')  env.deploymentModel      = change.proposedValue
      if (change.type === 'constraint_add')     env.constraints          = [...new Set([...(env.constraints          || []), change.proposedValue])]
    }
    env.updatedAt = new Date().toISOString()
    client.environmentProfile = env

    // Apply assessment changes
    if (confirmedAssessmentChanges?.length > 0) {
      const { resources } = await containers.assessments.items
        .query({ query: 'SELECT * FROM c WHERE c.clientId = @cid', parameters: [{ name: '@cid', value: req.params.id }] })
        .fetchAll()

      let assessment = resources[0] || {
        id:           uuid(),
        clientId:     req.params.id,
        answers:      { governance: {}, risk: {}, strategy: {}, operations: {}, enablement: {} },
        scores:       {},
        overallScore: null,
        createdAt:    new Date().toISOString(),
      }

      for (const change of confirmedAssessmentChanges) {
        if (!assessment.answers[change.pillar]) assessment.answers[change.pillar] = {}
        assessment.answers[change.pillar][change.questionId] = change.proposedAnswer
        if (!assessment.answerSources)                  assessment.answerSources = {}
        if (!assessment.answerSources[change.pillar])   assessment.answerSources[change.pillar] = {}
        assessment.answerSources[change.pillar][change.questionId] = {
          source:    'meeting_notes',
          sessionId,
          appliedAt: new Date().toISOString(),
          evidence:  change.evidence,
        }
      }

      // Recalculate scores
      const SCORE_MAP = { 'Not started': 1, 'In progress': 2, 'Implemented': 3, 'Optimized': 5 }
      const pillars   = ['governance', 'risk', 'strategy', 'operations', 'enablement']
      for (const p of pillars) {
        const vals = Object.values(assessment.answers[p] || {}).filter(Boolean)
        assessment.scores[p] = vals.length
          ? Math.round((vals.map(v => SCORE_MAP[v] || 0).reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : null
      }
      const valid = pillars.map(p => assessment.scores[p]).filter(Boolean)
      assessment.overallScore = valid.length
        ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
        : null
      assessment.updatedAt = new Date().toISOString()

      await containers.assessments.items.upsert(assessment)
      client.scores       = assessment.scores
      client.overallScore = assessment.overallScore
    }

    // Update session record status
    const sessionIdx = (client.sessionHistory || []).findIndex(s => s.id === sessionId)
    if (sessionIdx >= 0) {
      client.sessionHistory[sessionIdx].status                       = 'applied'
      client.sessionHistory[sessionIdx].appliedAt                    = new Date().toISOString()
      client.sessionHistory[sessionIdx].confirmedProfileChanges      = confirmedProfileChanges
      client.sessionHistory[sessionIdx].confirmedAssessmentChanges   = confirmedAssessmentChanges
      if (sessionNotes) client.sessionHistory[sessionIdx].sessionNotes = sessionNotes
    }

    client.updatedAt = new Date().toISOString()
    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(client)

    res.json(updated)
  } catch (err) {
    console.error('Apply changes error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/clients/:id/agent-recommendations — save generated recommendations
router.patch('/:id/agent-recommendations', async (req, res) => {
  try {
    const { resource: existing } = await containers.clients
      .item(req.params.id, req.params.id).read()
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    existing.agentRecommendations = {
      agents:          req.body.agents      || [],
      generatedAt:     new Date().toISOString(),
      configSnapshot:  req.body.configSnapshot || {},
    }
    existing.updatedAt = new Date().toISOString()

    const { resource: updated } = await containers.clients
      .item(req.params.id, req.params.id).replace(existing)
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
