import { useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Download, Loader } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import ActionPlanPanel from '../components/ActionPlanPanel.jsx'
import './Results.css'

const PILLAR_COLORS = {
  governance: '#4A9FE0', risk: '#E8A838', strategy: '#8B5CF6',
  operations: '#3DBA7E', enablement: '#EC4899',
}
const PILLAR_LABELS = {
  governance: 'Governance', risk: 'Risk', strategy: 'Strategy',
  operations: 'Operations', enablement: 'Enablement',
}

const RECOMMENDATIONS = [
  {
    priority: 1,
    pillar: 'Enablement',
    score: 1.9,
    color: '#EC4899',
    title: 'Launch AI Literacy Program',
    effort: 'Quick Win',
    effortColor: '#3DBA7E',
    description: 'Deploy AI literacy training across business units. Establish a Center of Excellence within 60 days.',
    timeline: '30-60 days',
    impact: 'High',
  },
  {
    priority: 2,
    pillar: 'Risk & Compliance',
    score: 2.1,
    color: '#E8A838',
    title: 'Build AI Risk Framework',
    effort: 'Medium',
    effortColor: '#E8A838',
    description: 'Document data policies, create a model registry, and implement monitoring dashboards for production AI.',
    timeline: '60-90 days',
    impact: 'High',
  },
  {
    priority: 3,
    pillar: 'Operations',
    score: 2.8,
    color: '#3DBA7E',
    title: 'Standardize MLOps Practice',
    effort: 'Medium',
    effortColor: '#E8A838',
    description: 'Define deployment standards, automated testing pipelines, and model lifecycle management processes.',
    timeline: '90-120 days',
    impact: 'Medium',
  },
]

const NEXT_STEPS = [
  { label: 'Week 1-2',  title: 'Gap Analysis Workshop',   desc: 'Deep-dive session with IT and HR leads to validate findings.' },
  { label: 'Week 3-4',  title: 'Roadmap Sign-off',        desc: 'Present prioritized roadmap to executive sponsors.' },
  { label: 'Month 2',   title: 'Quick Wins Execution',    desc: 'Launch AI literacy program and begin risk policy documentation.' },
  { label: 'Month 3+',  title: 'Managed AI Services',     desc: 'Zones-managed monitoring and governance program kickoff.' },
]

export default function Results() {
  const contentRef = useRef(null)
  const [exporting,  setExporting]  = useState(false)
  const [panelItem,  setPanelItem]  = useState(null)
  const { client } = useClient()

  const scores      = client?.scores || {}
  const SCORES      = Object.entries(PILLAR_COLORS).map(([key, color]) => ({
    name: PILLAR_LABELS[key], score: scores[key] ?? 0, color,
  }))
  const overallScore = client?.overallScore ?? '—'
  const clientName   = client?.name ?? 'No client selected'

  async function exportPDF() {
    setExporting(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#0A1628', scrollY: -window.scrollY,
      })
      const pdf         = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth   = pdf.internal.pageSize.getWidth()
      const pageHeight  = pdf.internal.pageSize.getHeight()
      const ratio       = pageWidth / canvas.width
      const scaledHeight = canvas.height * ratio
      let yPos = 0
      while (yPos < scaledHeight) {
        pdf.addImage(canvas, 'PNG', 0, -yPos, pageWidth, scaledHeight)
        yPos += pageHeight
        if (yPos < scaledHeight) pdf.addPage()
      }
      pdf.save(`${clientName.replace(/\s+/g, '-')}-AI-Maturity-Report.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="results" ref={contentRef}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Roadmap</h1>
          <p className="page-sub">{clientName} · Generated {new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</p>
        </div>
        <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
          {exporting
            ? <><Loader size={14} className="spin" /> Generating…</>
            : <><Download size={14} /> Export PDF Report</>}
        </button>
      </div>

      <div className="results-summary">
        <div className="summary-intro">
          <div className="summary-score">{overallScore}{overallScore !== '—' && <span>/5</span>}</div>
          <div className="summary-label">Overall AI Maturity</div>
          <div className="summary-stage">{client?.overallScore >= 4.5 ? 'Optimized' : client?.overallScore >= 3.5 ? 'Managed' : client?.overallScore >= 2.5 ? 'Defined' : client?.overallScore >= 1.5 ? 'Developing' : client?.overallScore ? 'Initial' : 'Not assessed'} Stage</div>
          <p className="summary-desc">
            {clientName} — AI maturity assessment across 5 pillars: Governance, Risk &amp; Compliance, AI Strategy, Operations, and Enablement.
            {client?.overallScore ? ' Review pillar scores and priority recommendations below.' : ' Complete the assessment to generate recommendations.'}
          </p>
        </div>
        <div className="results-chart">
          <div className="chart-title">Pillar Scores</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={SCORES} barSize={28}>
              <XAxis dataKey="name" tick={{fontSize:11, fill:'rgba(244,246,250,0.55)'}} axisLine={false} tickLine={false} />
              <YAxis domain={[0,5]} tick={{fontSize:10, fill:'rgba(244,246,250,0.35)'}} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{background:'#0F2040', border:'1px solid rgba(74,159,224,0.3)', borderRadius:8, fontSize:12, color:'#F4F6FA'}}
                cursor={{fill:'rgba(255,255,255,0.03)'}}
              />
              <Bar dataKey="score" radius={[4,4,0,0]}>
                {SCORES.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rec-section">
        <div className="section-title">Priority Recommendations</div>
        <div className="rec-list">
          {RECOMMENDATIONS.map(r => (
            <div
              key={r.priority}
              className="rec-card clickable"
              onClick={() => setPanelItem({ title: r.title, label: r.pillar })}
            >
              <div className="rec-priority" style={{background: r.color+'22', color: r.color}}>#{r.priority}</div>
              <div className="rec-content">
                <div className="rec-header">
                  <div>
                    <div className="rec-title">{r.title}</div>
                    <div className="rec-pillar" style={{color: r.color}}>{r.pillar} · Score: {r.score}/5</div>
                  </div>
                  <div className="rec-tags">
                    <span className="tag" style={{background: r.effortColor+'22', color: r.effortColor}}>{r.effort}</span>
                    <span className="tag tag-neutral">{r.timeline}</span>
                    <span className="tag tag-neutral">Impact: {r.impact}</span>
                  </div>
                </div>
                <p className="rec-desc">{r.description}</p>
                <div className="rec-plan-link">View full plan →</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="next-steps">
        <div className="section-title">Proposed Next Steps</div>
        <div className="steps-grid">
          {NEXT_STEPS.map(s => (
            <div
              key={s.label}
              className="next-step-card clickable"
              onClick={() => setPanelItem({ title: s.title, label: s.label })}
            >
              <div className="step-period">{s.label}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
              <div className="step-plan-link">Generate plan →</div>
            </div>
          ))}
        </div>
      </div>

      {panelItem && (
        <ActionPlanPanel
          item={panelItem}
          client={client}
          onClose={() => setPanelItem(null)}
        />
      )}
    </div>
  )
}
