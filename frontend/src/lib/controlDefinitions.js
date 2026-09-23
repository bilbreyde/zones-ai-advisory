// Azure Specialization audit control definitions — source: SPEC-audit-readiness.md
// Control ids match the keys stored on audit_evidence records in Cosmos DB
// keep in sync with backend/src/lib/controlDefinitions.js

export const SPECIALIZATIONS = [
  { id: 'infra-db',    name: 'Infrastructure and DB Migration to Azure', priority: 1, prerequisites: {} },
  { id: 'avd',         name: 'Azure Virtual Desktop',                    priority: 2, prerequisites: {} },
  { id: 'vmware',      name: 'Azure VMware Solution',                    priority: 2, prerequisites: { requiresThirdPartyCert: true } },
  { id: 'analytics',   name: 'Analytics on Microsoft Azure',             priority: 3, prerequisites: {} },
  { id: 'ai-apps',     name: 'AI Applications on Azure',                 priority: 4, prerequisites: {} },
  { id: 'ai-platform', name: 'AI Platform on Azure',                     priority: 4, prerequisites: {} },
]

export const CONTROL_STATUSES = ['not_started', 'in_progress', 'complete']

// specializationRules: per-specialization flags that modify a control
//   requiresTagaReport — TAGA report must accompany the evidence
//   skipIfNotDeployed  — control may be skipped if the tooling was not deployed

export const MODULE_A_CONTROLS = [
  {
    id: 'control_1_1',
    number: '1.1',
    name: 'Cloud & AI Adoption Business Strategy',
    module: 'moduleA',
    requiredEvidence: 'FinOps Review output + CASE assessment',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: '',
    specializationRules: {},
  },
  {
    id: 'control_1_2',
    number: '1.2',
    name: 'Cloud & AI Adoption Plan',
    module: 'moduleA',
    requiredEvidence: 'Cost management report + DevOps Capability Assessment',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: '',
    specializationRules: {},
  },
  {
    id: 'control_2_1',
    number: '2.1',
    name: 'Security & Governance Tooling',
    module: 'moduleA',
    requiredEvidence: 'Defender for Cloud or 3rd party security baseline + Cloud Adoption Security Review',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: '',
    specializationRules: {},
  },
  {
    id: 'control_2_2',
    number: '2.2',
    name: 'Well-Architected Workloads',
    module: 'moduleA',
    requiredEvidence: 'Well-Architected Review export',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: '',
    specializationRules: {},
  },
  {
    id: 'control_3_1',
    number: '3.1',
    name: 'Repeatable Deployment',
    module: 'moduleA',
    requiredEvidence: 'ALZ deployment evidence (Bicep/Terraform/ARM) + ALZ Review',
    customerCount: 2,
    evidenceWindowMonths: null, // spec states no evidence window for this control
    notes: '',
    specializationRules: {},
  },
  {
    id: 'control_3_2',
    number: '3.2',
    name: 'Plan for Skilling',
    module: 'moduleA',
    requiredEvidence: 'Skilling plan',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: 'TAGA report required for AI Apps and AI Platform',
    specializationRules: {
      'ai-apps':     { requiresTagaReport: true },
      'ai-platform': { requiresTagaReport: true },
    },
  },
  {
    id: 'control_3_3',
    number: '3.3',
    name: 'Operations Management Tooling',
    module: 'moduleA',
    requiredEvidence: 'Azure Monitor/Automation/Backup deployment + security compliance artifact',
    customerCount: 2,
    evidenceWindowMonths: 12,
    notes: 'Can be skipped for Analytics specialization if not deployed',
    specializationRules: {
      analytics: { skipIfNotDeployed: true },
    },
  },
]

function moduleBControl(number, name, requiredEvidence, notes = '') {
  return {
    id: `control_${number.replace('.', '_')}`,
    number,
    name,
    module: 'moduleB',
    requiredEvidence,
    customerCount: 3,
    evidenceWindowMonths: 24,
    notes,
    specializationRules: {},
  }
}

const AI_MODULE_B_CONTROLS = [
  moduleBControl('1.1', 'Assessment', 'AI use case inventory, readiness, AI Readiness Advisor output'),
  moduleBControl('2.1', 'Solution Design', 'AI architecture with model registry, monitoring, responsible AI docs'),
  moduleBControl('2.2', 'Well-Architected Review', 'WAR export 2 pillars, AI workload focus'),
  moduleBControl('3.1', 'Production Deployment', 'Production AI models with monitoring dashboards'),
  moduleBControl('4.1', 'Validation and Performance Testing', 'Model performance, customer sign-off'),
]

export const MODULE_B_CONTROLS = {
  'infra-db': [
    moduleBControl('1.1', 'Assessment', 'Migration readiness, source environment inventory, DMA reports'),
    moduleBControl('1.2', 'Solution Design', 'Migration architecture, schema strategy, ETL design'),
    moduleBControl('1.3', 'Well-Architected Review', 'WAR export 2 pillars per project'),
    moduleBControl('2.1', 'Production Deployment', 'Go-live evidence including migration scenario'),
    moduleBControl('2.2', 'Service Validation', 'Testing docs with customer sign-off'),
    moduleBControl('2.3', 'Post-deployment Documentation', 'Runbooks or operational handoff docs'),
  ],
  // AVD and VMware checklists pending — add when specialization checklists are uploaded
  'avd':    [],
  'vmware': [],
  'analytics': [
    moduleBControl('1.1', 'Assessment', 'Data landscape, ETL inventory, governance posture'),
    moduleBControl('2.1', 'Solution Design', 'Fabric/Databricks/Synapse architecture, at least 1 migration project'),
    moduleBControl('2.2', 'Well-Architected Review', '2 pillars per project, customer name visible'),
    moduleBControl('2.3', 'PoC or Pilot', 'Design validation with purpose, results, lessons learned'),
    moduleBControl('3.1', 'Production Deployment', 'At least 1 migration scenario'),
    moduleBControl('4.1', 'Validation and Performance Testing', 'Benchmarks, data reconciliation, customer sign-off'),
  ],
  'ai-apps':     AI_MODULE_B_CONTROLS,
  'ai-platform': AI_MODULE_B_CONTROLS,
}

// Module A + Module B controls for one specialization, with that specialization's
// rules flattened onto each control (e.g. requiresTagaReport, skipIfNotDeployed)
export function getControlsForSpecialization(specializationId) {
  const resolve = (control) => ({
    ...control,
    ...(control.specializationRules[specializationId] || {}),
  })
  return {
    moduleA: MODULE_A_CONTROLS.map(resolve),
    moduleB: (MODULE_B_CONTROLS[specializationId] || []).map(resolve),
  }
}

export const controlDefinitions = {
  specializations: SPECIALIZATIONS,
  statuses:        CONTROL_STATUSES,
  moduleA:         MODULE_A_CONTROLS,
  moduleB:         MODULE_B_CONTROLS,
}
