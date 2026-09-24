import { Router } from 'express'
import { containers } from '../db.js'
import { openai } from '../openai.js'
import { v4 as uuid } from 'uuid'
import {
  SPECIALIZATIONS, SPECIALIZATION_NAMES, MODULES, CONTROL_STATUSES as STATUSES, getControls, controlKey,
} from '../lib/controlDefinitions.js'
import { buildEvidenceDocument } from '../utils/evidenceDocument.js'
import { Packer } from 'docx'

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
    id: `${clientId}_${specialization}`,   // deterministic — a racing first write conflicts instead of duplicating
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

// ── Customer project registry (audit_projects) ───────────────────────────────
// Defined before the /:clientId/:specialization routes so "projects" is not read as a specialization.

const EDITABLE_PROJECT_FIELDS = [
  'projectName', 'customerName', 'goLiveDate', 'specializations', 'controlsEvidenced',
  'customerSignOff', 'signOffDocument', 'artifacts', 'notes',
]

// Validates a project body and returns { project } with normalized fields, or { error }
function normalizeProject(body) {
  const projectName = (body.projectName || '').trim()
  if (!projectName) return { error: 'projectName required' }

  const specializations = body.specializations || []
  if (!Array.isArray(specializations) || specializations.some(s => !SPECIALIZATIONS.includes(s))) {
    return { error: `specializations must be a list of: ${SPECIALIZATIONS.join(', ')}` }
  }

  // Compound keys "<specialization>:<module>:<controlId>" — only for the project's own specializations
  const validKeys = new Set()
  for (const spec of specializations) {
    for (const moduleKey of MODULES) {
      for (const id of controlIdsFor(moduleKey, spec)) validKeys.add(controlKey(spec, moduleKey, id))
    }
  }
  const controlsEvidenced = body.controlsEvidenced || []
  if (!Array.isArray(controlsEvidenced)) return { error: 'controlsEvidenced must be a list' }
  const badKey = controlsEvidenced.find(k => !validKeys.has(k))
  if (badKey) {
    return { error: `Control ${badKey} is not a valid "<specialization>:<module>:<controlId>" key for the selected specializations` }
  }

  if (body.goLiveDate && Number.isNaN(Date.parse(body.goLiveDate))) {
    return { error: 'goLiveDate must be a valid date' }
  }

  const artifacts = body.artifacts || []
  if (!Array.isArray(artifacts)) return { error: 'artifacts must be a list' }

  return {
    project: {
      projectName,
      customerName:      (body.customerName || '').trim(),
      goLiveDate:        body.goLiveDate || '',
      specializations,
      controlsEvidenced: [...new Set(controlsEvidenced)],
      customerSignOff:   Boolean(body.customerSignOff),
      signOffDocument:   (body.signOffDocument || '').trim(),
      artifacts:         artifacts.map(a => ({
        id:      a.id || uuid(),
        type:    a.type || 'link',
        name:    (a.name || '').trim(),
        url:     (a.url || '').trim(),
        addedAt: a.addedAt || new Date().toISOString(),
      })),
      notes: body.notes || '',
    },
  }
}

// GET /api/audit/:clientId/projects — all customer projects for the client
router.get('/:clientId/projects', async (req, res) => {
  try {
    const { resources } = await containers.audit_projects.items
      .query({
        query: 'SELECT * FROM c WHERE c.clientId = @clientId ORDER BY c.goLiveDate DESC',
        parameters: [{ name: '@clientId', value: req.params.clientId }],
      }, { partitionKey: req.params.clientId })
      .fetchAll()
    res.json(resources)
  } catch (err) {
    console.error('Audit projects list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/projects — add a customer project
router.post('/:clientId/projects', async (req, res) => {
  try {
    const { project, error } = normalizeProject(req.body)
    if (error) return res.status(400).json({ error })

    const now = new Date().toISOString()
    const { resource } = await containers.audit_projects.items.create({
      id:        uuid(),
      clientId:  req.params.clientId,
      ...project,
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json(resource)
  } catch (err) {
    console.error('Audit project create error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/audit/:clientId/projects/:projectId — replace a project's editable fields (requires _etag)
router.put('/:clientId/projects/:projectId', async (req, res) => {
  try {
    const { clientId, projectId } = req.params
    if (!req.body._etag) return res.status(400).json({ error: '_etag required' })

    const { resource: existing } = await containers.audit_projects.item(projectId, clientId).read()
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    const merged = Object.fromEntries(
      EDITABLE_PROJECT_FIELDS.map(f => [f, req.body[f] !== undefined ? req.body[f] : existing[f]]))
    const { project, error } = normalizeProject(merged)
    if (error) return res.status(400).json({ error })

    const { resource } = await containers.audit_projects
      .item(projectId, clientId)
      .replace(
        { ...existing, ...project, updatedAt: new Date().toISOString() },
        { accessCondition: { type: 'IfMatch', condition: req.body._etag } },
      )
    res.json(resource)
  } catch (err) {
    // 412 Precondition Failed — the project changed after the caller read it
    if (err.code === 412) return res.status(409).json({ error: 'Save conflict — project has changed' })
    console.error('Audit project update error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/projects/:projectId/signoff — record customer sign-off (requires _etag)
router.post('/:clientId/projects/:projectId/signoff', async (req, res) => {
  try {
    const { clientId, projectId } = req.params
    const { documentUrl, _etag } = req.body
    if (!_etag) return res.status(400).json({ error: '_etag required' })

    const { resource: existing } = await containers.audit_projects.item(projectId, clientId).read()
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    const { resource } = await containers.audit_projects
      .item(projectId, clientId)
      .replace(
        {
          ...existing,
          customerSignOff: true,
          signOffDocument: (documentUrl || '').trim(),
          updatedAt:       new Date().toISOString(),
        },
        { accessCondition: { type: 'IfMatch', condition: _etag } },
      )
    res.json(resource)
  } catch (err) {
    // 412 Precondition Failed — the project changed after the caller read it
    if (err.code === 412) return res.status(409).json({ error: 'Save conflict — project has changed' })
    console.error('Audit project sign-off error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/audit/:clientId/projects/:projectId — remove a project
router.delete('/:clientId/projects/:projectId', async (req, res) => {
  try {
    await containers.audit_projects.item(req.params.projectId, req.params.clientId).delete()
    res.status(204).end()
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Project not found' })
    console.error('Audit project delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Months between a go-live date and now; null when the date is missing or invalid
function monthsSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// Evidence window check for one project against the controls it evidences in this specialization.
// Module A windows are 12 months (3.1 has none), Module B windows are 24 months.
function evidenceWindowStatus(project, specialization) {
  const age = monthsSince(project.goLiveDate)
  if (age === null) return { status: 'unknown', label: 'No go-live date', ageMonths: null }

  const windows = (project.controlsEvidenced || [])
    .filter(k => k.startsWith(`${specialization}:`))
    .map(k => {
      const [, moduleKey, controlId] = k.split(':')
      return getControls(moduleKey, specialization).find(c => c.id === controlId)?.evidenceWindowMonths
    })
    .filter(Boolean)

  const exceeded = windows.filter(w => age > w)
  if (!exceeded.length) return { status: 'within', label: 'Within evidence window', ageMonths: age }
  return {
    status:    'outside',
    label:     `Outside ${Math.min(...exceeded)}-month window (${age} months since go-live)`,
    ageMonths: age,
  }
}

// Evidence package summary for one specialization — shared by the JSON and Word exports.
// Returns null when the client does not exist.
async function buildExportSummary(clientId, specialization) {
  const client = await readClient(clientId)
  if (!client) return null

  const record = await findEvidenceRecord(clientId, specialization)
    || newEvidenceRecord(clientId, specialization)

  const { resources: allProjects } = await containers.audit_projects.items
    .query({
      query: 'SELECT * FROM c WHERE c.clientId = @clientId',
      parameters: [{ name: '@clientId', value: clientId }],
    }, { partitionKey: clientId })
    .fetchAll()

  // Projects registered for this specialization, with their evidence window status
  const projects = allProjects
    .filter(p => (p.specializations || []).includes(specialization)
      || (p.controlsEvidenced || []).some(k => k.startsWith(`${specialization}:`)))
    .map(p => ({
      id:                p.id,
      projectName:       p.projectName,
      customerName:      p.customerName || '',
      goLiveDate:        p.goLiveDate,
      customerSignOff:   p.customerSignOff,
      signOffDocument:   p.signOffDocument || '',
      controlsEvidenced: (p.controlsEvidenced || []).filter(k => k.startsWith(`${specialization}:`)),
      evidenceWindow:    evidenceWindowStatus(p, specialization),
    }))

  const summarize = (module) => getControls(module, specialization).map(def => {
    const controlId = def.id
    const control   = record[module]?.[controlId] || { status: 'not_started', artifacts: [], notes: '' }
    const key       = controlKey(specialization, module, controlId)
    return {
      controlId,
      name:                 def.name,
      requiredEvidence:     def.requiredEvidence,
      customerCount:        def.customerCount,
      evidenceWindowMonths: def.evidenceWindowMonths,
      skippable:            (def.skipIfNotDeployed || []).includes(specialization),
      status:               control.status,
      notes:                control.notes,
      artifacts:            control.artifacts,
      projects:             projects
        .filter(p => p.controlsEvidenced.includes(key))
        .map(p => ({
          id:              p.id,
          projectName:     p.projectName,
          customerName:    p.customerName,
          goLiveDate:      p.goLiveDate,
          customerSignOff: p.customerSignOff,
          signOffDocument: p.signOffDocument,
          // Outside this control's own window (a project can sit inside one window and outside another)
          outsideWindow:   def.evidenceWindowMonths != null
            && p.evidenceWindow.ageMonths != null
            && p.evidenceWindow.ageMonths > def.evidenceWindowMonths,
        })),
    }
  })

  const moduleA = summarize('moduleA')
  const moduleB = summarize('moduleB')
  const all     = [...moduleA.map(c => ({ ...c, module: 'moduleA' })), ...moduleB.map(c => ({ ...c, module: 'moduleB' }))]
  const done    = all.filter(c => c.status === 'complete').length

  return {
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
    projects,
    gaps: all
      .filter(c => c.status !== 'complete')
      .map(c => ({
        module:           c.module,
        controlId:        c.controlId,
        name:             c.name,
        requiredEvidence: c.requiredEvidence,
        status:           c.status,
        skippable:        c.skippable,
      })),
  }
}

// LLM "Next Steps" for the Word package: executive summary + 3-5 recommended actions from the gaps
async function generateNextSteps(summary) {
  const gapLines = summary.gaps.map(g =>
    `- ${g.module === 'moduleA' ? 'Module A' : 'Module B'} ${g.controlId.replace('control_', '').replace('_', '.')} ${g.name} (${g.status}): requires ${g.requiredEvidence}`)
  const outside = summary.projects.filter(p => p.evidenceWindow.status === 'outside')

  const prompt = `You are a Microsoft Azure partner advisor at Zones preparing a client for an Azure Specialization audit.

Client: ${summary.clientName}
Specialization: ${SPECIALIZATION_NAMES[summary.specialization]}
Readiness: ${summary.readiness.completeControls} of ${summary.readiness.totalControls} controls complete (${summary.readiness.percentComplete}%)
Registered customer projects: ${summary.projects.length} (Module B controls need 3 unique customers, Module A controls need 2)
Projects outside their evidence window: ${outside.map(p => p.projectName).join(', ') || 'none'}

OPEN GAPS:
${gapLines.join('\n') || 'None — all controls complete'}

Write an executive summary and 3-5 recommended next actions, prioritised by audit risk. Be specific to the gaps above — name the controls and the evidence to collect. No generic advice.

Return ONLY a raw JSON object:
{
  "executiveSummary": "2-3 sentence summary of audit readiness and the most important risk",
  "actions": [
    { "title": "Short action title", "detail": "1-2 sentences: what to do and which controls it closes", "owner": "Suggested owner role", "timeframe": "e.g. Next 2 weeks" }
  ]
}`

  const completion = await openai.chat.completions.create({
    model:       process.env.AZURE_OPENAI_DEPLOYMENT,
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 2400,
  })
  const result = parseJSON(completion.choices[0].message.content)
  return { executiveSummary: result.executiveSummary || '', actions: (result.actions || []).slice(0, 5) }
}

// GET /api/audit/:clientId/export/:specialization — evidence package summary
router.get('/:clientId/export/:specialization', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }

    const summary = await buildExportSummary(clientId, specialization)
    if (!summary) return res.status(404).json({ error: 'Client not found' })
    res.json(summary)
  } catch (err) {
    console.error('Audit export error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/export-docx/:specialization — Word evidence package
router.post('/:clientId/export-docx/:specialization', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }

    const summary = await buildExportSummary(clientId, specialization)
    if (!summary) return res.status(404).json({ error: 'Client not found' })

    // Next Steps is advisory — if the LLM call fails, still deliver the package with a note
    let nextSteps
    try {
      nextSteps = await generateNextSteps(summary)
    } catch (err) {
      console.error('Audit next steps generation failed:', err.message)
      nextSteps = { error: 'Next steps could not be generated for this export. Re-export to try again.' }
    }

    const buffer   = await Packer.toBuffer(buildEvidenceDocument(summary, nextSteps))
    const date     = new Date().toISOString().split('T')[0]
    const filename = `AuditReadiness-${summary.clientName.replace(/[^A-Za-z0-9]+/g, '-')}-${specialization}-${date}.docx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) {
    console.error('Audit evidence docx error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/generate/skilling-plan — LLM-generated skilling plan
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
      model:       process.env.AZURE_OPENAI_DEPLOYMENT,
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_completion_tokens: 5000,
    })

    const plan = parseJSON(completion.choices[0].message.content)
    res.json({ clientId: client.id, specialization, generatedAt: new Date().toISOString(), plan })
  } catch (err) {
    console.error('Audit skilling plan error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/generate/finops-checklist — LLM-generated FinOps Review prep checklist
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
      model:       process.env.AZURE_OPENAI_DEPLOYMENT,
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_completion_tokens: 5000,
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
    const { module, control, status, notes, _etag } = req.body

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

    const stored = await findEvidenceRecord(clientId, specialization)

    // Optimistic concurrency: the caller must send the _etag of the record it last read.
    // No _etag means the caller saw no saved record yet, so one existing now is a conflict.
    if (stored && !_etag) return res.status(409).json({ error: 'Save conflict — record has changed' })
    if (!stored && _etag)  return res.status(409).json({ error: 'Save conflict — record no longer exists' })

    const record   = stored || newEvidenceRecord(clientId, specialization)
    const existing = record[module][control] || { status: 'not_started', artifacts: [], notes: '' }
    record[module][control] = {
      ...existing,
      status: status ?? existing.status,
      notes:  notes  ?? existing.notes,
    }
    record.updatedAt = new Date().toISOString()

    const { resource } = stored
      ? await containers.audit_evidence
          .item(record.id, clientId)
          .replace(record, { accessCondition: { type: 'IfMatch', condition: _etag } })
      : await containers.audit_evidence.items.create(record)
    res.json(resource)
  } catch (err) {
    // 409 Conflict — a simultaneous first save already created the record with this id
    if (err.code === 409) return res.status(409).json({ error: 'Save conflict — record has changed' })
    // 412 Precondition Failed — the record changed after the caller read it
    if (err.code === 412) return res.status(409).json({ error: 'Save conflict — record has changed' })
    console.error('Audit control update error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/:clientId/:specialization/artifact — append an artifact to a control
router.post('/:clientId/:specialization/artifact', async (req, res) => {
  try {
    const { clientId, specialization } = req.params
    const { module, control, artifactType, artifactData, _etag } = req.body

    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }
    if (!MODULES.includes(module)) return res.status(400).json({ error: 'module must be moduleA or moduleB' })
    if (!controlIdsFor(module, specialization).includes(control)) {
      return res.status(400).json({ error: `Unknown control ${control} for ${module} / ${specialization}` })
    }
    if (!artifactType) return res.status(400).json({ error: 'artifactType required' })

    const stored = await findEvidenceRecord(clientId, specialization)

    // Optimistic concurrency — same rules as PUT /control
    if (stored && !_etag) return res.status(409).json({ error: 'Save conflict — record has changed' })
    if (!stored && _etag)  return res.status(409).json({ error: 'Save conflict — record no longer exists' })

    const record   = stored || newEvidenceRecord(clientId, specialization)
    const existing = record[module][control] || { status: 'not_started', artifacts: [], notes: '' }
    const artifact = {
      id:      uuid(),
      type:    artifactType,
      data:    artifactData ?? null,
      addedAt: new Date().toISOString(),
    }
    record[module][control] = { ...existing, artifacts: [...(existing.artifacts || []), artifact] }
    record.updatedAt = new Date().toISOString()

    const { resource } = stored
      ? await containers.audit_evidence
          .item(record.id, clientId)
          .replace(record, { accessCondition: { type: 'IfMatch', condition: _etag } })
      : await containers.audit_evidence.items.create(record)
    res.status(201).json(resource)
  } catch (err) {
    // 409 Conflict — a simultaneous first save already created the record with this id
    if (err.code === 409) return res.status(409).json({ error: 'Save conflict — record has changed' })
    // 412 Precondition Failed — the record changed after the caller read it
    if (err.code === 412) return res.status(409).json({ error: 'Save conflict — record has changed' })
    console.error('Audit artifact error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/audit/:clientId/:specialization/artifact/:artifactId — replace an artifact's content (requires _etag)
router.put('/:clientId/:specialization/artifact/:artifactId', async (req, res) => {
  try {
    const { clientId, specialization, artifactId } = req.params
    const { module, control, artifactType, artifactData, _etag } = req.body

    if (!SPECIALIZATIONS.includes(specialization)) {
      return res.status(400).json({ error: `Unknown specialization: ${specialization}` })
    }
    if (!MODULES.includes(module)) return res.status(400).json({ error: 'module must be moduleA or moduleB' })
    if (!controlIdsFor(module, specialization).includes(control)) {
      return res.status(400).json({ error: `Unknown control ${control} for ${module} / ${specialization}` })
    }
    if (!_etag) return res.status(400).json({ error: '_etag required' })

    const record = await findEvidenceRecord(clientId, specialization)
    if (!record) return res.status(404).json({ error: 'Audit record not found' })

    const existing  = record[module][control] || { status: 'not_started', artifacts: [], notes: '' }
    const artifacts = existing.artifacts || []
    const index     = artifacts.findIndex(a => a.id === artifactId)
    if (index === -1) return res.status(404).json({ error: 'Artifact not found' })

    artifacts[index] = {
      ...artifacts[index],
      type:      artifactType || artifacts[index].type,
      data:      artifactData ?? artifacts[index].data,
      updatedAt: new Date().toISOString(),
    }
    record[module][control] = { ...existing, artifacts }
    record.updatedAt = new Date().toISOString()

    const { resource } = await containers.audit_evidence
      .item(record.id, clientId)
      .replace(record, { accessCondition: { type: 'IfMatch', condition: _etag } })
    res.json(resource)
  } catch (err) {
    // 412 Precondition Failed — the record changed after the caller read it
    if (err.code === 412) return res.status(409).json({ error: 'Save conflict — record has changed' })
    console.error('Audit artifact update error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
