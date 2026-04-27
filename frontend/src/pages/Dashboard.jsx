import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Shield, AlertTriangle, Lightbulb, Settings, Zap, ArrowRight, TrendingUp, Users, Save, Loader, Sparkles, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import MeetingNotes from '../components/MeetingNotes.jsx'
import EnvironmentProfile from '../components/EnvironmentProfile.jsx'
import { getStalenessStatus, getCheckInQuestion } from '../lib/staleness.js'
import '../components/EnvironmentProfile.css'
import './Dashboard.css'

const API = import.meta.env.VITE_API_URL || ''

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

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { client, setClient } = useClient()

  // Live assessment scores
  const [assessment, setAssessment] = useState(null)

  // Session notes
  const [sessions,    setSessions]    = useState([])
  const [noteText,    setNoteText]    = useState('')
  const [savingNote,  setSavingNote]  = useState(false)
  const [noteSaved,   setNoteSaved]   = useState(false)

  // Meeting notes modal
  const [showMeetingNotes, setShowMeetingNotes] = useState(false)

  // Staleness banner
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showEnvProfile,  setShowEnvProfile]  = useState(false)

  // Session history collapse state
  const [historyOpen, setHistoryOpen] = useState(false)

  // Executive narrative card
  const [narrative,        setNarrative]        = useState('')
  const [narrativeLoading, setNarrativeLoading] = useState(false)

  // Reset banner when client switches
  useEffect(() => { setBannerDismissed(false) }, [client?.id])

  useEffect(() => {
    if (!client) return
    setAssessment(null)
    setSessions([])
    setNoteText('')

    // Fetch live assessment scores
    fetch(`${API}/api/assessments/${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAssessment(data) })
      .catch(() => {})

    // Fetch session notes
    fetch(`${API}/api/sessions/${client.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setSessions(data)
        const current = data.find(s => s.sessionNumber === client.currentSession)
        if (current) setNoteText(current.notes || '')
      })
      .catch(() => {})
  }, [client?.id])

  // Fetch executive narrative when client + assessment scores are available
  useEffect(() => {
    if (!client) return
    setNarrative('')
    setNarrativeLoading(true)
    const scores = client.scores || {}
    const overallScore = client.overallScore ?? null
    const ctx = { name: client.name, scores, overallScore }
    fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Write a 2–3 sentence executive summary for ${client.name}'s AI maturity. Highlight their strongest pillar and most critical gap. Keep it boardroom-ready.` }],
        clientContext: ctx,
        format: 'text',
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.reply) setNarrative(data.reply) })
      .catch(() => {})
      .finally(() => setNarrativeLoading(false))
  }, [client?.id])

  async function saveNote() {
    if (!client) return
    setSavingNote(true)
    try {
      await fetch(`${API}/api/sessions/${client.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber: client.currentSession,
          notes: noteText,
          advisor: client.advisor || '',
        }),
      })
      // Refresh sessions list
      const data = await fetch(`${API}/api/sessions/${client.id}`).then(r => r.json())
      setSessions(data)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
    } catch {}
    finally { setSavingNote(false) }
  }

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

  // Use live assessment scores, fall back to client object scores from context
  const scores = assessment?.scores || client.scores || {}
  const overallScore = assessment?.overallScore ?? client.overallScore ?? null
  const PILLARS = PILLAR_META.map(p => ({ ...p, score: scores[p.id] ?? null }))
  const radarData = PILLARS.map(p => ({ subject: p.label.split(' ')[0], score: p.score ?? 0, fullMark: 5 }))

  const staleness      = useMemo(() => getStalenessStatus(client, assessment), [client, assessment])
  const checkInQuestion = useMemo(() => getCheckInQuestion(client, client?.environmentProfile), [client?.id, client?.environmentProfile])

  const previousSessions = sessions.filter(s => s.sessionNumber !== client.currentSession)

  return (
    <div className="dashboard">
      {/* Meeting Notes modal */}
      {showMeetingNotes && client && (
        <MeetingNotes
          client={client}
          onComplete={updated => setClient(updated)}
          onClose={() => setShowMeetingNotes(false)}
        />
      )}

      {/* Environment Profile modal (from staleness banner) */}
      {showEnvProfile && client && (
        <EnvironmentProfile
          client={client}
          onComplete={updated => { setClient(updated); setShowEnvProfile(false) }}
          onSkip={() => setShowEnvProfile(false)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">AI Maturity Dashboard</h1>
          <p className="page-sub">{client.name}{client.advisor ? ` · Advisor: ${client.advisor}` : ''} · Session {client.currentSession}</p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => setShowMeetingNotes(true)}>
            <FileText size={13} /> Add Meeting Notes
          </button>
          <button className="btn-outline" onClick={() => navigate('/results')}>
            View Full Report
          </button>
          <button className="btn-primary" onClick={() => navigate('/assessment')}>
            Continue Assessment <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Staleness banner */}
      {staleness.anyStale && !bannerDismissed && (
        <div className="staleness-banner">
          <div className="sb-icon">🕐</div>
          <div className="sb-content">
            <div className="sb-title">
              {staleness.mostStale.label} last updated {staleness.mostStale.daysSince} days ago
            </div>
            <div className="sb-question">Before we dive in — {checkInQuestion}</div>
          </div>
          <button className="sb-update" onClick={() => setShowEnvProfile(true)}>Update profile</button>
          <button className="sb-dismiss" onClick={() => setBannerDismissed(true)}>✕</button>
        </div>
      )}

      {(narrative || narrativeLoading) && (
        <div className="narrative-card">
          <div className="narrative-icon"><Sparkles size={13} /></div>
          <div className="narrative-body">
            <div className="narrative-label">Executive Summary</div>
            {narrativeLoading
              ? <div className="narrative-loading"><span /><span /><span /></div>
              : <div className="narrative-text">{narrative}</div>
            }
          </div>
        </div>
      )}

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
                <div className="score-fill" style={{width: `${((p.score ?? 0)/5)*100}%`, background: p.color}} />
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
                contentStyle={{background:'#0F2040', border:'1px solid rgba(74,159,224,0.3)', borderRadius:8, fontSize:12, color:'#F4F6FA'}}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="gaps-card">
          <div className="card-title">Priority Gaps</div>
          <div className="gap-list">
            {[...PILLARS].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).map(p => {
              const gap = p.score != null ? 5 - p.score : null
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
                        <div className="gap-fill" style={{width:`${((p.score ?? 0)/5)*100}%`, background:p.color}} />
                      </div>
                      <span className="gap-score">{p.score ?? '—'}</span>
                    </div>
                  </div>
                  {gap != null
                    ? <div className="gap-delta">+{gap.toFixed(1)}</div>
                    : <div className="gap-delta" style={{color:'var(--z-muted)'}}>—</div>
                  }
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
              { n:1, label:'Kickoff & Discovery'       },
              { n:2, label:'Strategy Alignment'        },
              { n:3, label:'Maturity Assessment'       },
              { n:4, label:'Gap Analysis & Priorities' },
              { n:5, label:'Roadmap Delivery'          },
              { n:6, label:'Executive Readout'         },
            ].map((s, i, arr) => {
              const done   = s.n < client.currentSession
              const active = s.n === client.currentSession
              return (
                <div key={s.n} className="roadmap-step">
                  <div className={`step-node ${done ? 'done' : active ? 'active' : ''}`}>
                    {done ? '✓' : s.n}
                  </div>
                  {i < arr.length - 1 && <div className={`step-connector ${done ? 'done' : ''}`} />}
                  <div className={`step-label ${active ? 'active' : ''}`}>{s.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Task 3: Session notes */}
      <div className="notes-card">
        <div className="notes-header">
          <div className="card-title" style={{margin:0}}>Session Notes</div>
          <span className="notes-session-badge">Session {client.currentSession}</span>
        </div>
        <textarea
          className="notes-textarea"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder={`Add advisor notes for Session ${client.currentSession}…`}
          rows={4}
        />
        <div className="notes-actions">
          <button className="notes-import-link" onClick={() => setShowMeetingNotes(true)}>
            Import from meeting transcript
          </button>
          <button className="btn-primary" onClick={saveNote} disabled={savingNote}>
            {savingNote
              ? <><Loader size={13} className="spin" /> Saving…</>
              : noteSaved
                ? '✓ Saved'
                : <><Save size={13} /> Save Notes</>
            }
          </button>
        </div>

        {previousSessions.length > 0 && (
          <div className="prev-sessions">
            <div className="prev-sessions-label">Previous Sessions</div>
            {previousSessions.map(s => (
              <div key={s.id} className="prev-session">
                <div className="prev-session-header">
                  <span>Session {s.sessionNumber}</span>
                  {s.advisor && <span className="prev-session-advisor">{s.advisor}</span>}
                  <span className="prev-session-date">{fmt(s.updatedAt)}</span>
                </div>
                <div className="prev-session-notes">{s.notes || <em>No notes recorded.</em>}</div>
              </div>
            ))}
          </div>
        )}

        {/* Session History from meeting notes */}
        {(client.sessionHistory?.length > 0) && (
          <div className="session-history">
            <div
              className="session-history-label"
              onClick={() => setHistoryOpen(o => !o)}
            >
              <span>Meeting History ({client.sessionHistory.length})</span>
              {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
            {historyOpen && client.sessionHistory.slice(0, 5).map(session => (
              <div key={session.id} className="session-history-item">
                <div className="shi-date">
                  {new Date(session.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {session.status === 'applied' && (
                    <span className="shi-applied-badge">Applied</span>
                  )}
                </div>
                <div className="shi-summary">{session.extractedSummary || 'No summary available.'}</div>
                <div className="shi-stats">
                  {(session.confirmedProfileChanges?.length || 0)} profile changes ·{' '}
                  {(session.confirmedAssessmentChanges?.length || 0)} assessment updates
                  {session.participants?.length > 0 && (
                    <> · {session.participants.join(', ')}</>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
