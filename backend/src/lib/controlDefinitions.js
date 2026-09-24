// Azure Specialization audit controls — used for validation, export gap lists and the
// Word evidence package.
//
// keep in sync with frontend/src/lib/controlDefinitions.js
// Every control in BOTH copies must have exactly these fields:
//   id, number, name, module, specializationId, requiredEvidence, customerCount,
//   evidenceWindowMonths, skipIfNotDeployed, taga, notes
//     specializationId   — null for Module A (shared), the specialization id for Module B
//     skipIfNotDeployed  — specialization ids where the control may be skipped if not deployed
//     taga               — specialization ids that require a TAGA report with this control's evidence
// The control data below (moduleAControl … MODULE_B_CONTROLS) is identical in both copies.
//
// Project control links (audit_projects.controlsEvidenced) use compound keys:
//   "${specializationId}:${moduleKey}:${controlId}"  e.g. "infra-db:moduleB:control_1_1"

export const SPECIALIZATIONS = ['infra-db', 'avd', 'vmware', 'analytics', 'ai-apps', 'ai-platform']

export const SPECIALIZATION_NAMES = {
  'infra-db':    'Infrastructure and DB Migration to Azure',
  'avd':         'Azure Virtual Desktop',
  'vmware':      'Azure VMware Solution',
  'analytics':   'Analytics on Microsoft Azure',
  'ai-apps':     'AI Applications on Azure',
  'ai-platform': 'AI Platform on Azure',
}

export const MODULES = ['moduleA', 'moduleB']

export const CONTROL_STATUSES = ['not_started', 'in_progress', 'complete']

// ── Control data (identical in frontend and backend copies) ──────────────────

// Module A: shared across specializations — 2 unique customers, last 12 months
function moduleAControl(number, name, requiredEvidence, extra = {}) {
  return {
    id: `control_${number.replace('.', '_')}`,
    number,
    name,
    module: 'moduleA',
    specializationId: null,
    requiredEvidence,
    customerCount: 2,
    evidenceWindowMonths: 12,
    skipIfNotDeployed: [],
    taga: [],
    notes: '',
    ...extra,
  }
}

// Module B: specialization-specific — 3 unique customers, last 24 months
function moduleBControl(specializationId, number, name, requiredEvidence) {
  return {
    id: `control_${number.replace('.', '_')}`,
    number,
    name,
    module: 'moduleB',
    specializationId,
    requiredEvidence,
    customerCount: 3,
    evidenceWindowMonths: 24,
    skipIfNotDeployed: [],
    taga: [],
    notes: '',
  }
}

export const MODULE_A_CONTROLS = [
  moduleAControl('1.1', 'Cloud & AI Adoption Business Strategy', 'FinOps Review output + CASE assessment'),
  moduleAControl('1.2', 'Cloud & AI Adoption Plan', 'Cost management report + DevOps Capability Assessment'),
  moduleAControl('2.1', 'Security & Governance Tooling', 'Defender for Cloud or 3rd party security baseline + Cloud Adoption Security Review'),
  moduleAControl('2.2', 'Well-Architected Workloads', 'Well-Architected Review export'),
  moduleAControl('3.1', 'Repeatable Deployment', 'ALZ deployment evidence (Bicep/Terraform/ARM) + ALZ Review',
    { evidenceWindowMonths: null }),   // spec states no evidence window for this control
  moduleAControl('3.2', 'Plan for Skilling', 'Skilling plan',
    { taga: ['ai-apps', 'ai-platform'], notes: 'TAGA report required for AI Apps and AI Platform' }),
  moduleAControl('3.3', 'Operations Management Tooling', 'Azure Monitor/Automation/Backup deployment + security compliance artifact',
    { skipIfNotDeployed: ['analytics'], notes: 'Can be skipped for Analytics specialization if not deployed' }),
]

function aiModuleBControls(specializationId) {
  return [
    moduleBControl(specializationId, '1.1', 'Assessment', 'AI use case inventory, readiness, AI Readiness Advisor output'),
    moduleBControl(specializationId, '2.1', 'Solution Design', 'AI architecture with model registry, monitoring, responsible AI docs'),
    moduleBControl(specializationId, '2.2', 'Well-Architected Review', 'WAR export 2 pillars, AI workload focus'),
    moduleBControl(specializationId, '3.1', 'Production Deployment', 'Production AI models with monitoring dashboards'),
    moduleBControl(specializationId, '4.1', 'Validation and Performance Testing', 'Model performance, customer sign-off'),
  ]
}

export const MODULE_B_CONTROLS = {
  'infra-db': [
    moduleBControl('infra-db', '1.1', 'Assessment', 'Migration readiness, source environment inventory, DMA reports'),
    moduleBControl('infra-db', '1.2', 'Solution Design', 'Migration architecture, schema strategy, ETL design'),
    moduleBControl('infra-db', '1.3', 'Well-Architected Review', 'WAR export 2 pillars per project'),
    moduleBControl('infra-db', '2.1', 'Production Deployment', 'Go-live evidence including migration scenario'),
    moduleBControl('infra-db', '2.2', 'Service Validation', 'Testing docs with customer sign-off'),
    moduleBControl('infra-db', '2.3', 'Post-deployment Documentation', 'Runbooks or operational handoff docs'),
  ],
  // AVD and VMware checklists pending — add when specialization checklists are uploaded
  'avd':    [],
  'vmware': [],
  'analytics': [
    moduleBControl('analytics', '1.1', 'Assessment', 'Data landscape, ETL inventory, governance posture'),
    moduleBControl('analytics', '2.1', 'Solution Design', 'Fabric/Databricks/Synapse architecture, at least 1 migration project'),
    moduleBControl('analytics', '2.2', 'Well-Architected Review', '2 pillars per project, customer name visible'),
    moduleBControl('analytics', '2.3', 'PoC or Pilot', 'Design validation with purpose, results, lessons learned'),
    moduleBControl('analytics', '3.1', 'Production Deployment', 'At least 1 migration scenario'),
    moduleBControl('analytics', '4.1', 'Validation and Performance Testing', 'Benchmarks, data reconciliation, customer sign-off'),
  ],
  'ai-apps':     aiModuleBControls('ai-apps'),
  'ai-platform': aiModuleBControls('ai-platform'),
}

export function controlKey(specializationId, moduleKey, controlId) {
  return `${specializationId}:${moduleKey}:${controlId}`
}

// ── End of shared control data ───────────────────────────────────────────────

export function getControls(module, specialization) {
  return module === 'moduleA' ? MODULE_A_CONTROLS : (MODULE_B_CONTROLS[specialization] || [])
}
