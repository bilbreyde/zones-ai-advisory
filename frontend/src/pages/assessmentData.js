export const QUESTIONS = {
  governance: [
    { id:'g1', text:'Does your organization have a documented AI governance policy?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'g2', text:'Is there a dedicated AI governance committee or owner?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'g3', text:'Are AI initiatives reviewed and approved through a formal process?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'g4', text:'Do you have defined roles and responsibilities for AI oversight?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'g5', text:'Is AI governance integrated into your broader IT governance framework?', options:['Not started','In progress','Implemented','Optimized'] },
  ],
  risk: [
    { id:'r1', text:'Does your organization have documented AI data usage and retention policies?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r2', text:'Is there a defined process for monitoring AI model outputs for bias or drift?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r3', text:'Are AI risks included in your enterprise risk register?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r4', text:'Do you perform security assessments on AI systems before deployment?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r5', text:'Is there a regulatory compliance review process for AI use cases?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r6', text:'Do you have an AI incident response plan?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r7', text:'Are third-party AI vendors subject to risk assessments?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'r8', text:'Is there a process for employee reporting of AI-related concerns?', options:['Not started','In progress','Implemented','Optimized'] },
  ],
  strategy: [
    { id:'s1', text:'Does your organization have a documented AI strategy aligned to business goals?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'s2', text:'Are AI investments prioritized based on business value and feasibility?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'s3', text:'Is there executive sponsorship for AI initiatives?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'s4', text:'Do you have a defined AI roadmap with milestones and KPIs?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'s5', text:'Is AI capability building part of your strategic workforce planning?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'s6', text:'Do you benchmark your AI maturity against industry peers?', options:['Not started','In progress','Implemented','Optimized'] },
  ],
  operations: [
    { id:'o1', text:'Do you have standardized processes for AI model development and deployment?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'o2', text:'Is there a model registry to track AI assets in production?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'o3', text:'Are AI systems monitored for performance and availability in production?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'o4', text:'Do you have automated testing processes for AI systems?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'o5', text:'Is there a defined MLOps or AI operations practice?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'o6', text:'Are data pipelines for AI documented and maintained?', options:['Not started','In progress','Implemented','Optimized'] },
  ],
  enablement: [
    { id:'e1', text:'Do employees have access to AI literacy training?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'e2', text:'Is there a center of excellence or AI community of practice?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'e3', text:'Are AI tools and platforms available to business users (not just IT)?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'e4', text:'Do you measure AI adoption rates and outcomes across teams?', options:['Not started','In progress','Implemented','Optimized'] },
    { id:'e5', text:'Is change management included in AI project delivery?', options:['Not started','In progress','Implemented','Optimized'] },
  ],
}

export const PILLAR_COLORS = {
  governance: '#4A9FE0',
  risk:       '#E8A838',
  strategy:   '#8B5CF6',
  operations: '#3DBA7E',
  enablement: '#EC4899',
}

export const PILLAR_LABELS = {
  governance: 'Governance',
  risk:       'Risk & Compliance',
  strategy:   'AI Strategy',
  operations: 'Operations',
  enablement: 'Enablement',
}

export const ALL_PILLARS = ['governance', 'risk', 'strategy', 'operations', 'enablement']

export const PILLAR_META = [
  { id: 'governance', label: 'Governance',       color: '#4A9FE0' },
  { id: 'risk',       label: 'Risk & Compliance', color: '#E8A838' },
  { id: 'strategy',   label: 'AI Strategy',       color: '#8B5CF6' },
  { id: 'operations', label: 'Operations',        color: '#3DBA7E' },
  { id: 'enablement', label: 'Enablement',        color: '#EC4899' },
]
