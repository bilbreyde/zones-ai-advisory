import { useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Shield, AlertTriangle, Lightbulb, Settings, Zap, ArrowRight, TrendingUp, Users } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import './Dashboard.css'

const PILLAR_META = [
  { id: 'governance',  label: 'Governance',       color: '#4A9FE0', icon: Shield        },
  { id: 'risk',        label: 'Risk & Compliance', color: '#E8A838', icon: AlertTriangle },
  { id: 'strategy',    label: 'AI Strategy',       color: '#8B5CF6', icon: Lightbulb    },
  { id: 'operations',  label: 'Operations',        color: '#3DBA7E', icon: Settings     },
  { id: 'enablement',  label: 'Enablement',        color: '#EC4899', icon: Zap          },
]

const MATURITY = score => {
  if (score == null)  return { label: 'Not started', color: '#666' }
  if (score >= 4.5)   return { label: 'Optimized',   color: '#3DBA7E' }
  if (score >= 3.5)   return { label: 'Managed',     color: '#4A9FE0' }
  if (score >= 2.5)   return { label: 'Defined',     color: '#8B5CF6' }
  if (score >= 1.5)   return { label: 'Developing',  color: '#E8A838' }
  return               { label: 'Initial',      color: '#E05A4E' }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { client } = useClient()

  if (!client) {
    return (
      <div className="dashboard">
        <div className="no-client">
          <Users size={32} style={{color:'var(--z-muted)'}} />
          <h2>No client selected</h2>
          <p>Go to the Clients page and click a client to begin.</p>
          <button className="btn-primary" onClick={() => navigate('/clients')}>
            View Clients <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  const scores = client.scores || {}
  const PILLARS = PILLAR_META.map(p => ({ ...p, score: scores[p.id] ?? null }))
  const radarData = PILLARS.map(p => ({ subject: p.label.split(' ')[0], score: p.score ?? 0, fullMark: 5 }))
  const overallScore = client.overallScore

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Maturity Dashboard</h1>
          <p className="page-sub">{client.name}{client.advisor ? ` · Advisor: ${client.advisor}` : ''} · Session {client.currentSession}</p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => navigate('/results')}>
            View Full Report
          </button>
          <button className="btn-primary" onClick={() => navigate('/assessment')}>
            Continue Assessment <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-card highlight">
          <div className="metric-icon"><TrendingUp size={16} /></div>
          <div className="metric-value">{overallScore ?? '—'}{overallScore != null && <span>/5</span>}</div>
          <div className="metric-label">Overall Maturity</div>
          <div className="metric-badge" style={{background: MATURITY(overallScore).color + '22', color: MATURITY(overallScore).color}}>
            {MATURITY(overallScore).label}
          </div>
        </div>
        {PILLARS.map(p => {
          const m = MATURITY(p.score)
          const Icon = p.icon
          return (
            <div
              key={p.id}
              className="metric-card"
              onClick={() => navigate(`/assessment/${p.id}`)}
              style={{cursor:'pointer'}}
            >
              <div className="metric-icon" style={{color: p.color, background: p.color+'22'}}>
                <Icon size={15} />
              </div>
              <div className="metric-value" style={{color: p.color}}>
                {p.score ?? '—'}{p.score != null && <span>/5</span>}
              </div>
              <div className="metric-label">{p.label}</div>
              <div className="score-bar">
                <div className="score-fill" style={{width: `${(p.score/5)*100}%`, background: p.color}} />
              </div>
              <div className="metric-badge" style={{background: m.color+'22', color: m.color}}>
                {m.label}
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-body">
        <div className="radar-card">
          <div className="card-title">Maturity Radar</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(74,159,224,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{fontSize:11, fill:'rgba(244,246,250,0.6)'}} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#4A9FE0"
                fill="#4A9FE0"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background:'#0F2040',
                  border:'1px solid rgba(74,159,224,0.3)',
                  borderRadius:8,
                  fontSize:12,
                  color:'#F4F6FA'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="gaps-card">
          <div className="card-title">Priority Gaps</div>
          <div className="gap-list">
            {[...PILLARS].sort((a,b) => a.score - b.score).map(p => {
              const gap = 5 - p.score
              const Icon = p.icon
              return (
                <div key={p.id} className="gap-item" onClick={() => navigate(`/assessment/${p.id}`)}>
                  <div className="gap-icon" style={{color:p.color, background:p.color+'22'}}>
                    <Icon size={13} />
                  </div>
                  <div className="gap-content">
                    <div className="gap-name">{p.label}</div>
                    <div className="gap-bar-wrap">
                      <div className="gap-bar">
                        <div className="gap-fill" style={{width:`${(p.score/5)*100}%`, background:p.color}} />
                      </div>
                      <span className="gap-score">{p.score}</span>
                    </div>
                  </div>
                  <div className="gap-delta">+{gap.toFixed(1)} gap</div>
                  <ArrowRight size={12} style={{color:'var(--z-muted)', flexShrink:0}} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="roadmap-card">
          <div className="card-title">Engagement Progress</div>
          <div className="roadmap-steps">
            {[
              { n:1, label:'Kickoff & Discovery',       done:true  },
              { n:2, label:'Strategy Alignment',        done:true  },
              { n:3, label:'Maturity Assessment',       active:true},
              { n:4, label:'Gap Analysis & Priorities', done:false },
              { n:5, label:'Roadmap Delivery',          done:false },
              { n:6, label:'Executive Readout',         done:false },
            ].map((s, i, arr) => (
              <div key={s.n} className="roadmap-step">
                <div className={`step-node ${s.done ? 'done' : s.active ? 'active' : ''}`}>
                  {s.done ? '✓' : s.n}
                </div>
                {i < arr.length - 1 && (
                  <div className={`step-connector ${s.done ? 'done' : ''}`} />
                )}
                <div className={`step-label ${s.active ? 'active' : ''}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
