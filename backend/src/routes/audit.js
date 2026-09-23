import { Router } from 'express'
import { containers } from '../db.js'
import { openai } from '../openai.js'
import { v4 as uuid } from 'uuid'
import {
  SPECIALIZATIONS, MODULES, CONTROL_STATUSES as STATUSES, getControls,
} from '../lib/controlDefinitions.js'

const router = Router()

function parseJSON(raw) {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
}

function controlIdsFor(module, specialization) {
  return getControls(module, specialization).map(c => c.id)
}

function emptyControls(ids) {
  return Object.fromEntries(ids.map(id => [id, { status: 'not_started', artifacts: [], notes: '' }]))
}

function newEvidenceRecord(clientId, specialization) {
  return {
    id: uuid(),
    clientId,
    specialization,
    moduleA: emptyControls(controlIdsFor('moduleA', specialization)),
    moduleB: emptyControls(controlIdsFor('moduleB', specialization)),
    customerProjects: [],
    updatedAt: new Date().toISOString(),
  }
}

async function findEvidenceRecord(clientId, specialization) {
  const { resources } = await containers.audit_evidence.items
    .query({
      query: 'SELECT * FROM c WHERE c.clientId = @clientId AND c.specialization = @specialization',
      parameters: [
        { name: '@clientId',       value: clientId },
        { name: '@specialization', value: specialization },
      ],
    }, { partitionKey: clientId })
    .fetchAll()
  return resources[0] || null
}

async function readClient(clientId) {
  const { resource } = await containers.clients.item(clientId, clientId).read()
  return resource || null
}

// GET /api/audit/:clientId — all specialization records for the client
router.get('/:clientId', async (req, res) => {
  try {
    const { resources } = await containers.audit_evidence.items
      .query({
        query: 'SELECT * FROM c WHERE c.clientId = @clientId',
        parameters: [{ name: '@clientId', value: req.params.clientId }],
      }, { partitionKey: req.params.clientId })
      .fetchAll()
    res.json(resources)
  } catch (err) {
    console.error('Audit list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/audit/:clientId/export/:specialization — evidence package summary
router.get('/:clientId/export/:specialization', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }

    const client = await readClient(clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const record = await findEvidenceRecord(clientId, specialization)
      || newEvidenceRecord(clientId, specialization)

    const { resources: projects } = await containers.audit_projects.items
      .query({
        query: 'SELECT * FROM c WHERE c.clientId = @clientId',
        parameters: [{ name: '@clientId', value: clientId }],
      }, { partitionKey: clientId })
      .fetchAll()

    const summarize = (module) => getControls(module, specialization).map(def => {
      const controlId = def.id
      const control   = record[module]?.[controlId] || { status: 'not_started', artifacts: [], notes: '' }
      const key       = `${module}.${controlId}`
      return {
        controlId,
        name:      def.name,
        skippable: (def.skipIfNotDeployed || []).includes(specialization),
        status:    control.status,
        notes:     control.notes,
        artifacts: control.artifacts,
        projects:  projects
          .filter(p => (p.controlsEvidenced || []).includes(key))
          .map(p => ({
            id:              p.id,
            projectName:     p.projectName,
            goLiveDate:      p.goLiveDate,
            customerSignOff: p.customerSignOff,
          })),
      }
    })

    const moduleA = summarize('moduleA')
    const moduleB = summarize('moduleB')
    const all     = [...moduleA.map(c => ({ ...c, module: 'moduleA' })), ...moduleB.map(c => ({ ...c, module: 'moduleB' }))]
    const done    = all.filter(c => c.status === 'complete').length

    res.json({
      clientId,
      clientName:     client.name,
      specialization,
      generatedAt:    new Date().toISOString(),
      readiness: {
        completeControls: done,
        totalControls:    all.length,
        percentComplete:  all.length ? Math.round((done / all.length) * 100) : 0,
      },
      moduleA,
      moduleB,
      gaps: all
        .filter(c => c.status !== 'complete')
        .map(c => ({
          module:    c.module,
          controlId: c.controlId,
          name:      c.name,
          status:    c.status,
          skippable: c.skippable,
        })),
    })
  } catch (err) {
    console.error('Audit export error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/generate/skilling-plan — GPT-4o skilling plan
router.post('/:clientId/generate/skilling-plan', async (req, res) => {
  try {
    const client = await readClient(req.params.clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const ep             = client.environmentProfile || {}
    const specialization = req.body.specialization || ''
    const needsTaga      = ['ai-apps', 'ai-platform'].includes(specialization)

    const prompt = `You are a Microsoft Azure partner advisor at Zones preparing a customer skilling plan that will be submitted as evidence for Azure Specialization audit control 3.2 "Plan for Skilling".

Client: ${client.name}
Industry: ${client.industry || 'Unknown'}
Target specialization: ${specialization || 'General Azure'}
Deployment model: ${ep.deploymentModel || 'unknown'}
Cloud tools / deployed services: ${(ep.cloudTools || []).join(', ') || 'Unknown'}
On-premises tools: ${(ep.onPremTools || []).join(', ') || 'None'}
Legacy systems: ${(ep.legacySystems || []).join(', ') || 'None'}
Compliance frameworks: ${(ep.complianceFrameworks || []).join(', ') || 'None'}
${needsTaga ? '\nThis is an AI specialization — the plan MUST reference the Microsoft TAGA (Technical Assessment for Generative AI) report findings as an input and map skilling to its gaps.\n' : ''}
The plan must be specific to this customer's technology profile. Reference Microsoft Learn paths and role-based certifications (e.g. AZ-104, AZ-305, DP-203, AI-102) by exact name where appropriate.

Return ONLY a raw JSON object:
{
  "title": "Skilling plan title",
  "summary": "2-3 sentence overview of the skilling objective",
  "roles": [
    {
      "role": "Role name (e.g. Cloud Administrator)",
      "headcount": "estimated number or range",
      "currentGaps": ["specific skill gaps tied to their environment"],
      "learningPaths": ["Microsoft Learn path names"],
      "certifications": ["exam code and name"],
      "timeline": "e.g. Months 1-3"
    }
  ],
  "milestones": [
    { "milestone": "description", "targetDate": "relative timing e.g. Month 2", "owner": "role" }
  ],
  "successMetrics": ["measurable outcome"],${needsTaga ? '\n  "tagaAlignment": "How this plan addresses TAGA report findings",' : ''}
  "customerSignOff": "Suggested sign-off statement for the customer"
}`

    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  2500,
    })

    const plan = parseJSON(completion.choices[0].message.content)
    res.json({ clientId: client.id, specialization, generatedAt: new Date().toISOString(), plan })
  } catch (err) {
    console.error('Audit skilling plan error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/generate/finops-checklist — GPT-4o FinOps Review prep checklist
router.post('/:clientId/generate/finops-checklist', async (req, res) => {
  try {
    const client = await readClient(req.params.clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const ep = client.environmentProfile || {}

    const prompt = `You are a Microsoft Azure partner advisor at Zones preparing a customer for a Microsoft FinOps Review, which is required evidence for Azure Specialization audit control 1.1 "Cloud & AI Adoption Business Strategy".

Client: ${client.name}
Industry: ${client.industry || 'Unknown'}
Deployment model: ${ep.deploymentModel || 'unknown'}
Cloud tools / deployed services: ${(ep.cloudTools || []).join(', ') || 'Unknown'}
On-premises tools: ${(ep.onPremTools || []).join(', ') || 'None'}
Legacy systems: ${(ep.legacySystems || []).join(', ') || 'None'}
Compliance frameworks: ${(ep.complianceFrameworks || []).join(', ') || 'None'}
Constraints: ${(ep.constraints || []).join(', ') || 'None'}

Build a preparation checklist mapped to this customer's Azure environment. Organize it by FinOps Framework domains (Understand Cloud Usage and Cost, Quantify Business Value, Optimize Cloud Usage and Cost, Manage the FinOps Practice). Each item must name the specific Azure tool or data source (e.g. Cost Management exports, Azure Advisor, budgets, tagging policy, reservations) and what evidence to capture.

Return ONLY a raw JSON object:
{
  "title": "Checklist title",
  "summary": "2-3 sentence overview",
  "sections": [
    {
      "domain": "FinOps domain name",
      "items": [
        {
          "task": "Specific preparation task",
          "azureTool": "Azure tool or data source",
          "evidence": "What artifact to capture for the audit",
          "owner": "Customer role responsible",
          "priority": "high|medium|low"
        }
      ]
    }
  ],
  "prerequisites": ["access or permissions needed before the review"],
  "risks": ["environment-specific risks that could weaken the review"]
}`

    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  2500,
    })

    const checklist = parseJSON(completion.choices[0].message.content)
    res.json({ clientId: client.id, generatedAt: new Date().toISOString(), checklist })
  } catch (err) {
    console.error('Audit FinOps checklist error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/audit/:clientId/:specialization — control status map for one specialization
router.get('/:clientId/:specialization', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }

    const record = await findEvidenceRecord(clientId, specialization)
    res.json(record || newEvidenceRecord(clientId, specialization))
  } catch (err) {
    console.error('Audit get error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/audit/:clientId/:specialization/control — update one control's status/notes
router.put('/:clientId/:specialization/control', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    const { module, control, status, notes } = req.body

    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }
    if (!MODULES.includes(module)) return res.status(400).json({ error: 'module must be moduleA or moduleB' })
    if (!controlIdsFor(module, specialization).includes(control)) {
      return res.status(400).json({ error: `Unknown control ${control} for ${module} / ${specialization}` })
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` })
    }

    const record = await findEvidenceRecord(clientId, specialization)
      || newEvidenceRecord(clientId, specialization)

    const existing = record[module][control] || { status: 'not_started', artifacts: [], notes: '' }
    record[module][control] = {
      ...existing,
      status: status ?? existing.status,
      notes:  notes  ?? existing.notes,
    }
    record.updatedAt = new Date().toISOString()

    const { resource } = await containers.audit_evidence.items.upsert(record)
    res.json(resource)
  } catch (err) {
    console.error('Audit control update error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/:specialization/artifact — append an artifact to a control
router.post('/:clientId/:specialization/artifact', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    const { module, control, artifactType, artifactData } = req.body

    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }
    if (!MODULES.includes(module)) return res.status(400).json({ error: 'module must be moduleA or moduleB' })
    if (!controlIdsFor(module, specialization).includes(control)) {
      return res.status(400).json({ error: `Unknown control ${control} for ${module} / ${specialization}` })
    }
    if (!artifactType) return res.status(400).json({ error: 'artifactType required' })

    const record = await findEvidenceRecord(clientId, specialization)
      || newEvidenceRecord(clientId, specialization)

    const existing = record[module][control] || { status: 'not_started', artifacts: [], notes: '' }
    const artifact = {
      id:      uuid(),
      type:    artifactType,
      data:    artifactData ?? null,
      addedAt: new Date().toISOString(),
    }
    record[module][control] = { ...existing, artifacts: [...(existing.artifacts || []), artifact] }
    record.updatedAt = new Date().toISOString()

    const { resource } = await containers.audit_evidence.items.upsert(record)
    res.status(201).json(resource)
  } catch (err) {
    console.error('Audit artifact error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
