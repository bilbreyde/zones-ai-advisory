import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak, LevelFormat, SimpleField,
} from 'docx'
import { SPECIALIZATION_NAMES } from '../lib/controlDefinitions.js'

// Word evidence package for one specialization — built from buildExportSummary() and
// generateNextSteps() in routes/audit.js. Styling follows the SoW document in
// routes/cloud-modernization.js.

const NAVY    = '0D1B3E'
const BLUE    = '2962FF'
const BDR     = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: BDR, bottom: BDR, left: BDR, right: BDR }
const cm      = { top: 100, bottom: 100, left: 150, right: 150 }
const PAGE_W  = 9720   // content width in DXA (Letter, 0.875" margins)

const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }
const STATUS_COLORS = { not_started: '888888', in_progress: 'D97706', complete: '16A34A' }
const WINDOW_COLORS = { within: '16A34A', outside: 'D97706', unknown: '888888' }

// Artifact types produced by the LLM generators — rendered in full in the appendix
const GENERATED_TYPES = { 'skilling-plan': 'Skilling Plan', 'finops-checklist': 'FinOps Review Checklist' }

function controlNumber(controlId) {
  return controlId.replace('control_', '').replace('_', '.')
}

// "infra-db:moduleB:control_2_1" → "B 2.1"
function shortKey(key) {
  const [, moduleKey, controlId] = key.split(':')
  return `${moduleKey === 'moduleA' ? 'A' : 'B'} ${controlNumber(controlId)}`
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 28, color: NAVY, font: 'Arial' })],
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 } },
  })
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 24, color: NAVY, font: 'Arial' })],
    spacing: { before: 240, after: 120 },
  })
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 22, color: NAVY, font: 'Arial' })],
    spacing: { before: 160, after: 80 },
  })
}
function body(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text: text || '', size: 22, font: 'Arial', ...options })],
    spacing: { before: 80, after: 80 },
  })
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [new TextRun({ text: text || '', size: 22, font: 'Arial' })],
    spacing: { before: 40, after: 40 },
  })
}
function labelled(label, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Arial', color: NAVY }),
      new TextRun({ text: text || '', size: 22, font: 'Arial' }),
    ],
    spacing: { before: 60, after: 60 },
  })
}
function spacer() {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: 80, after: 80 } })
}
function twoColTable(rows) {
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [3200, PAGE_W - 3200],
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          borders, width: { size: 3200, type: WidthType.DXA }, margins: cm,
          shading: { fill: 'EEF1FA', type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 21, font: 'Arial', color: NAVY })] })],
        }),
        new TableCell({
          borders, width: { size: PAGE_W - 3200, type: WidthType.DXA }, margins: cm,
          children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 21, font: 'Arial' })] })],
        }),
      ],
    })),
  })
}
function hdrCell(text, w) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cm,
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })],
  })
}
function dataCell(text, w, shade, runOptions = {}) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cm,
    shading: { fill: shade, type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 19, font: 'Arial', ...runOptions })] })],
  })
}
function dataTable(headers, widths, rows) {
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((t, i) => hdrCell(t, widths[i])) }),
      ...rows.map((cells, r) => new TableRow({
        children: cells.map((cell, i) => {
          const { text, ...runOptions } = typeof cell === 'string' ? { text: cell } : cell
          return dataCell(text, widths[i], r % 2 ? 'F5F6FA' : 'FFFFFF', runOptions)
        }),
      })),
    ],
  })
}

// Section 2 / 3 — control table: number, name, status, linked projects vs required, notes
function controlTable(controls, moduleLetter) {
  const widths = [800, 2900, 1300, 1300, PAGE_W - 6300]
  return dataTable(
    ['Control', 'Name', 'Status', 'Projects', 'Notes'],
    widths,
    controls.map(c => [
      { text: `${moduleLetter} ${controlNumber(c.controlId)}`, bold: true },
      c.skippable ? `${c.name} (optional if not deployed)` : c.name,
      { text: STATUS_LABELS[c.status] || c.status, bold: true, color: STATUS_COLORS[c.status] },
      `${c.projects.length} / ${c.customerCount}${c.projects.some(p => p.outsideWindow) ? ' ⚠' : ''}`,
      c.notes || '—',
    ]),
  )
}

function skillingPlanSection(plan) {
  const out = [h2(plan.title || 'Skilling Plan')]
  if (plan.summary) out.push(body(plan.summary))
  if (plan.tagaAlignment) out.push(labelled('TAGA alignment', plan.tagaAlignment))
  for (const role of plan.roles || []) {
    out.push(h3(`${role.role}${role.headcount ? ` (${role.headcount})` : ''}`))
    if (role.timeline) out.push(labelled('Timeline', role.timeline))
    if (role.currentGaps?.length)    out.push(labelled('Skills needed', role.currentGaps.join('; ')))
    if (role.learningPaths?.length)  out.push(labelled('Microsoft Learn paths', role.learningPaths.join('; ')))
    if (role.certifications?.length) out.push(labelled('Certifications', role.certifications.join('; ')))
  }
  if (plan.milestones?.length) {
    out.push(h3('Milestones'))
    plan.milestones.forEach(m => out.push(bullet(`${m.targetDate ? `${m.targetDate}: ` : ''}${m.milestone}${m.owner ? ` (${m.owner})` : ''}`)))
  }
  if (plan.successMetrics?.length) {
    out.push(h3('Success metrics'))
    plan.successMetrics.forEach(m => out.push(bullet(m)))
  }
  if (plan.customerSignOff) out.push(labelled('Customer sign-off', plan.customerSignOff))
  return out
}

function finopsChecklistSection(checklist) {
  const out = [h2(checklist.title || 'FinOps Review Checklist')]
  if (checklist.summary) out.push(body(checklist.summary))
  for (const section of checklist.sections || []) {
    out.push(h3(section.domain))
    for (const item of section.items || []) {
      out.push(bullet(`${item.task}${item.priority ? ` [${item.priority}]` : ''}`))
      const detail = [
        item.azureTool && `Tool: ${item.azureTool}`,
        item.evidence  && `Evidence: ${item.evidence}`,
        item.owner     && `Owner: ${item.owner}`,
      ].filter(Boolean).join(' · ')
      if (detail) out.push(bullet(detail, 1))
    }
  }
  if (checklist.prerequisites?.length) {
    out.push(h3('Prerequisites'))
    checklist.prerequisites.forEach(p => out.push(bullet(p)))
  }
  if (checklist.risks?.length) {
    out.push(h3('Risks'))
    checklist.risks.forEach(r => out.push(bullet(r)))
  }
  return out
}

function artifactLabel(artifact) {
  const data = artifact.data || {}
  if (GENERATED_TYPES[artifact.type]) return `${GENERATED_TYPES[artifact.type]}: ${data.title || 'Generated document'}`
  const name = data.name || data.title || artifact.type
  return data.url ? `${name} — ${data.url}` : name
}

export function buildEvidenceDocument(summary, nextSteps = {}) {
  const specName  = SPECIALIZATION_NAMES[summary.specialization] || summary.specialization
  const today     = formatDate(summary.generatedAt)
  const moduleDone = list => list.filter(c => c.status === 'complete').length
  const customers = new Set(summary.projects.map(p => (p.customerName || '').trim().toLowerCase()).filter(Boolean))
  const signedOff = summary.projects.filter(p => p.customerSignOff).length
  const outside   = summary.projects.filter(p => p.evidenceWindow.status === 'outside')

  const all = [
    ...summary.moduleA.map(c => ({ ...c, letter: 'A' })),
    ...summary.moduleB.map(c => ({ ...c, letter: 'B' })),
  ]
  const withArtifacts = all.filter(c => (c.artifacts || []).length)
  const generatedDocs = withArtifacts.flatMap(c => c.artifacts
    .filter(a => GENERATED_TYPES[a.type] && a.data)
    .map(a => ({ ...a, control: `${c.letter} ${controlNumber(c.controlId)}` })))

  const children = [
    // ── Cover page ────────────────────────────────────────────────────────────
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'AZURE SPECIALIZATION', size: 52, bold: true, font: 'Arial', color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Audit Readiness Evidence Package', size: 36, font: 'Arial', color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: specName, size: 32, font: 'Arial', color: BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: summary.clientName, size: 30, bold: true, font: 'Arial', color: '333333' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: `Exported ${today}`, size: 22, font: 'Arial', color: '666666' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Prepared by Zones AI Innovation Group', size: 22, italics: true, font: 'Arial', color: '666666' })],
    }),
    new Paragraph({ children: [new PageBreak()] }),

    // ── Section 1: Executive Summary ──────────────────────────────────────────
    h1('1. Executive Summary'),
    twoColTable([
      ['Overall readiness', `${summary.readiness.percentComplete}% complete`],
      ['Controls complete', `${summary.readiness.completeControls} of ${summary.readiness.totalControls}`],
      ['Module A', `${moduleDone(summary.moduleA)} of ${summary.moduleA.length} complete`],
      ['Module B', summary.moduleB.length
        ? `${moduleDone(summary.moduleB)} of ${summary.moduleB.length} complete`
        : 'Checklist not yet available'],
      ['Customer projects registered', `${summary.projects.length} projects, ${customers.size} unique customers, ${signedOff} signed off`],
      ['Customer projects required', summary.moduleB.length
        ? '3 unique customers per Module B control; 2 per Module A control'
        : '2 unique customers per Module A control'],
      ['Evidence window', outside.length
        ? `${outside.length} project(s) outside an evidence window — see Section 5`
        : 'All dated projects within their evidence windows'],
    ]),
    spacer(),
  ]

  if (nextSteps.executiveSummary) children.push(body(nextSteps.executiveSummary))
  if (summary.specialization === 'vmware') {
    children.push(body('Prerequisite: Azure VMware Solution requires a VMware Certified Professional (VCP) credential held by a full-time employee. This is verified manually and is not covered by this package.', { italics: true }))
  }
  children.push(body('Module A waiver: a previous Module A+B Pass result within two years satisfies all Module A controls. Confirm waiver eligibility with your PDM before scheduling the audit.', { italics: true, color: '666666' }))

  // ── Section 2: Module A Controls ────────────────────────────────────────────
  children.push(h1('2. Module A Controls'))
  children.push(controlTable(summary.moduleA, 'A'))
  children.push(body('Projects column shows linked projects / unique customers required. ⚠ marks a control with a linked project outside its evidence window.', { size: 18, color: '888888', italics: true }))

  // ── Section 3: Module B Controls ────────────────────────────────────────────
  children.push(h1(`3. Module B Controls — ${specName}`))
  if (summary.moduleB.length) {
    children.push(controlTable(summary.moduleB, 'B'))
  } else {
    children.push(body('The Module B checklist for this specialization has not been added yet.', { italics: true }))
  }

  // ── Section 4: Gap Analysis ─────────────────────────────────────────────────
  children.push(h1('4. Gap Analysis'))
  if (summary.gaps.length) {
    children.push(body(`${summary.gaps.length} control(s) are not yet complete.`))
    for (const g of summary.gaps) {
      children.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 60, after: 20 },
        children: [
          new TextRun({ text: `${g.module === 'moduleA' ? 'A' : 'B'} ${controlNumber(g.controlId)} ${g.name}`, bold: true, size: 22, font: 'Arial' }),
          new TextRun({ text: ` — ${STATUS_LABELS[g.status]}`, size: 22, font: 'Arial', color: STATUS_COLORS[g.status] }),
          ...(g.skippable ? [new TextRun({ text: ' (optional if not deployed)', size: 22, font: 'Arial', italics: true, color: '888888' })] : []),
        ],
      }))
      children.push(bullet(`Required evidence: ${g.requiredEvidence}`, 1))
    }
  } else {
    children.push(body('No gaps — every control is complete.'))
  }

  // ── Section 5: Customer Projects ────────────────────────────────────────────
  children.push(h1('5. Customer Projects'))
  if (summary.projects.length) {
    const widths = [2000, 1500, 1350, 1250, 1500, PAGE_W - 7600]
    children.push(dataTable(
      ['Project', 'Customer', 'Go-live', 'Sign-off', 'Controls evidenced', 'Evidence window'],
      widths,
      summary.projects.map(p => [
        { text: p.projectName, bold: true },
        p.customerName || '—',
        p.goLiveDate ? formatDate(p.goLiveDate) : '—',
        { text: p.customerSignOff ? 'Signed off' : 'Pending', color: p.customerSignOff ? '16A34A' : 'D97706', bold: true },
        p.controlsEvidenced.length ? p.controlsEvidenced.map(shortKey).join(', ') : '—',
        { text: p.evidenceWindow.label, color: WINDOW_COLORS[p.evidenceWindow.status] },
      ]),
    ))
    const signOffDocs = summary.projects.filter(p => p.signOffDocument)
    if (signOffDocs.length) {
      children.push(h3('Sign-off documents'))
      signOffDocs.forEach(p => children.push(bullet(`${p.projectName}: ${p.signOffDocument}`)))
    }
  } else {
    children.push(body('No customer projects are registered for this specialization.', { italics: true }))
  }

  // ── Section 6: Next Steps (LLM-generated) ───────────────────────────────────
  children.push(h1('6. Next Steps'))
  if (nextSteps.error) {
    children.push(body(nextSteps.error, { italics: true, color: '888888' }))
  } else {
    (nextSteps.actions || []).forEach(a => {
      children.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: a.title, bold: true, size: 22, font: 'Arial', color: NAVY })],
      }))
      if (a.detail) children.push(body(a.detail))
      const meta = [a.owner && `Owner: ${a.owner}`, a.timeframe && `Timeframe: ${a.timeframe}`].filter(Boolean).join('  ·  ')
      if (meta) children.push(body(meta, { size: 20, color: '666666' }))
    })
    children.push(body(`Recommendations generated by Azure OpenAI (${process.env.AZURE_OPENAI_DEPLOYMENT}) from the gap analysis above; review before sharing.`, { size: 18, italics: true, color: '888888' }))
  }

  // ── Appendix: attached evidence (artifacts and documents added from the app) ─
  if (withArtifacts.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(h1('Appendix — Attached Evidence'))
    for (const c of withArtifacts) {
      children.push(h3(`${c.letter} ${controlNumber(c.controlId)} ${c.name}`))
      c.artifacts.forEach(a => children.push(bullet(`${artifactLabel(a)} (added ${formatDate(a.addedAt)})`)))
    }
    for (const doc of generatedDocs) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(body(`Attached to control ${doc.control} on ${formatDate(doc.addedAt)}`, { italics: true, color: '666666' }))
      children.push(...(doc.type === 'skilling-plan' ? skillingPlanSection(doc.data) : finopsChecklistSection(doc.data)))
    }
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          ],
        },
        {
          reference: 'numbers',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      // Footer text style — SimpleField runs take no formatting of their own, so they inherit this
      paragraphStyles: [{
        id: 'EvidenceFooter', name: 'Evidence Footer', basedOn: 'Normal',
        run: { font: 'Arial', size: 16, color: '888888' },
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'ZONES, LLC  |  AZURE SPECIALIZATION AUDIT READINESS  |  CONFIDENTIAL', size: 16, font: 'Arial', color: '888888' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          // PAGE / NUMPAGES as simple fields with a cached value. PageNumber.CURRENT / TOTAL_PAGES
          // emit fields with an empty cached result, which renders blank in any viewer that
          // doesn't recalculate fields (Word Online, Outlook/Explorer preview, Google Docs).
          // Desktop Word recalculates these on layout, so the cached "1" is only a fallback.
          children: [new Paragraph({
            style: 'EvidenceFooter',
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun(`${summary.clientName}  |  ${specName}  |  Page `),
              new SimpleField('PAGE', '1'),
              new TextRun(' of '),
              new SimpleField('NUMPAGES', '1'),
            ],
          })],
        }),
      },
      children,
    }],
  })
}
