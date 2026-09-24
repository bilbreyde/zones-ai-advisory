// Azure Specialization audit controls — ids, names and module assignments used for
// validation and export gap lists. The full definitions (required evidence, customer
// counts, evidence windows, flags) live in the frontend.
// keep in sync with frontend/src/lib/controlDefinitions.js
// Project control links (audit_projects.controlsEvidenced) use compound keys:
//   "${specializationId}:${moduleKey}:${controlId}"  e.g. "infra-db:moduleB:control_1_1"

export const SPECIALIZATIONS = ['infra-db', 'avd', 'vmware', 'analytics', 'ai-apps', 'ai-platform']

export const MODULES = ['moduleA', 'moduleB']

export const CONTROL_STATUSES = ['not_started', 'in_progress', 'complete']

export const MODULE_A_CONTROLS = [
  { id: 'control_1_1', name: 'Cloud & AI Adoption Business Strategy', module: 'moduleA' },
  { id: 'control_1_2', name: 'Cloud & AI Adoption Plan',              module: 'moduleA' },
  { id: 'control_2_1', name: 'Security & Governance Tooling',         module: 'moduleA' },
  { id: 'control_2_2', name: 'Well-Architected Workloads',            module: 'moduleA' },
  { id: 'control_3_1', name: 'Repeatable Deployment',                 module: 'moduleA' },
  { id: 'control_3_2', name: 'Plan for Skilling',                     module: 'moduleA' },
  { id: 'control_3_3', name: 'Operations Management Tooling',         module: 'moduleA', skipIfNotDeployed: ['analytics'] },
]

const AI_MODULE_B_CONTROLS = [
  { id: 'control_1_1', name: 'Assessment',                         module: 'moduleB' },
  { id: 'control_2_1', name: 'Solution Design',                    module: 'moduleB' },
  { id: 'control_2_2', name: 'Well-Architected Review',            module: 'moduleB' },
  { id: 'control_3_1', name: 'Production Deployment',              module: 'moduleB' },
  { id: 'control_4_1', name: 'Validation and Performance Testing', module: 'moduleB' },
]

export const MODULE_B_CONTROLS = {
  'infra-db': [
    { id: 'control_1_1', name: 'Assessment',                    module: 'moduleB' },
    { id: 'control_1_2', name: 'Solution Design',               module: 'moduleB' },
    { id: 'control_1_3', name: 'Well-Architected Review',       module: 'moduleB' },
    { id: 'control_2_1', name: 'Production Deployment',         module: 'moduleB' },
    { id: 'control_2_2', name: 'Service Validation',            module: 'moduleB' },
    { id: 'control_2_3', name: 'Post-deployment Documentation', module: 'moduleB' },
  ],
  // AVD and VMware checklists pending
  'avd':    [],
  'vmware': [],
  'analytics': [
    { id: 'control_1_1', name: 'Assessment',                         module: 'moduleB' },
    { id: 'control_2_1', name: 'Solution Design',                    module: 'moduleB' },
    { id: 'control_2_2', name: 'Well-Architected Review',            module: 'moduleB' },
    { id: 'control_2_3', name: 'PoC or Pilot',                       module: 'moduleB' },
    { id: 'control_3_1', name: 'Production Deployment',              module: 'moduleB' },
    { id: 'control_4_1', name: 'Validation and Performance Testing', module: 'moduleB' },
  ],
  'ai-apps':     AI_MODULE_B_CONTROLS,
  'ai-platform': AI_MODULE_B_CONTROLS,
}

export function controlKey(specializationId, moduleKey, controlId) {
  return `${specializationId}:${moduleKey}:${controlId}`
}

export function getControls(module, specialization) {
  return module === 'moduleA' ? MODULE_A_CONTROLS : (MODULE_B_CONTROLS[specialization] || [])
}
