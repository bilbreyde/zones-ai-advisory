import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Download, ArrowRight } from 'lucide-react'
import './Results.css'

const SCORES = [
  { name: 'Governance',   score: 3.2, color: '#4A9FE0' },
  { name: 'Risk',         score: 2.1, color: '#E8A838' },
  { name: 'Strategy',     score: 4.0, color: '#8B5CF6' },
  { name: 'Operations',   score: 2.8, color: '#3DBA7E' },
  { name: 'Enablement',   score: 1.9, color: '#EC4899' },
]

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

export default function Results() {
  return (
    <div className="results">
      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Roadmap</h1>
          <p className="page-sub">Acme Corp · Generated Apr 25, 2026</p>
        </div>
        <button className="btn-primary">
          <Download size={14} /> Export PDF Report
        </button>
      </div>

      <div className="results-summary">
        <div className="summary-intro">
          <div className="summary-score">2.8<span>/5</span></div>
          <div className="summary-label">Overall AI Maturity</div>
          <div className="summary-stage">Developing Stage</div>
          <p className="summary-desc">
            Acme Corp has established early AI capabilities with strong strategic vision, but significant gaps remain in risk management, operations, and workforce enablement. A focused 90-day program can close the most critical gaps.
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
            <div key={r.priority} className="rec-card">
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
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="next-steps">
        <div className="section-title">Proposed Next Steps</div>
        <div className="steps-grid">
          {[
            { label:'Week 1-2',  title:'Gap Analysis Workshop',    desc:'Deep-dive session with IT and HR leads to validate findings.' },
            { label:'Week 3-4',  title:'Roadmap Sign-off',         desc:'Present prioritized roadmap to executive sponsors.' },
            { label:'Month 2',   title:'Quick Wins Execution',     desc:'Launch AI literacy program and begin risk policy documentation.' },
            { label:'Month 3+',  title:'Managed AI Services',      desc:'Zones-managed monitoring and governance program kickoff.' },
          ].map(s => (
            <div key={s.label} className="next-step-card">
              <div className="step-period">{s.label}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
