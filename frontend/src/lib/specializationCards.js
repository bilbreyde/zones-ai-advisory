import { Database, Monitor, Server, BarChart2, Brain, Cpu } from 'lucide-react'
import { getControlsForSpecialization } from './controlDefinitions.js'

// Specialization selector cards shared by the Audit Readiness and Audit Export pages
export const SPECIALIZATION_CARDS = [
  { id: 'infra-db',    name: 'Infrastructure and DB Migration', icon: Database },
  { id: 'avd',         name: 'Azure Virtual Desktop',           icon: Monitor },
  { id: 'vmware',      name: 'Azure VMware Solution',           icon: Server,
    prerequisite: 'Requires VMware Certified Professional (VCP) credential held by a full-time employee' },
  { id: 'analytics',   name: 'Analytics on Azure',              icon: BarChart2 },
  { id: 'ai-apps',     name: 'AI Applications on Azure',        icon: Brain },
  { id: 'ai-platform', name: 'AI Platform on Azure',            icon: Cpu },
]

// Completion across Module A + Module B for one specialization's saved audit_evidence record
export function completionFor(specializationId, record) {
  const { moduleA, moduleB } = getControlsForSpecialization(specializationId)
  const all = [
    ...moduleA.map(c => record?.moduleA?.[c.id]?.status),
    ...moduleB.map(c => record?.moduleB?.[c.id]?.status),
  ]
  const complete   = all.filter(s => s === 'complete').length
  const inProgress = all.filter(s => s === 'in_progress').length
  const percent    = all.length ? Math.round((complete / all.length) * 100) : 0
  const status     = percent === 100 ? 'complete'
    : (percent > 0 || inProgress > 0) ? 'in_progress'
    : 'not_started'
  return { percent, status, complete, total: all.length }
}
