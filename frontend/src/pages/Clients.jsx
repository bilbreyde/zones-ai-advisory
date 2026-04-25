import ''./Clients.css''

const CLIENTS = [
  { initials:''AC'', name:''Acme Corp'',         advisor:''Sarah Mitchell'', session:3, status:''In Progress'', score:2.8 },
  { initials:''TG'', name:''TechGlobal Inc'',    advisor:''James Park'',     session:6, status:''Completed'',   score:4.1 },
  { initials:''NF'', name:''NorthField Energy'', advisor:''Sarah Mitchell'', session:1, status:''Kickoff'',      score:null },
  { initials:''MB'', name:''Metro Bank'',        advisor:''Don Bilbrey'',    session:2, status:''Assessment'',   score:1.9 },
]

const STATUS_COLORS = {
  ''In Progress'': ''#4A9FE0'',
  ''Completed'':   ''#3DBA7E'',
  ''Kickoff'':     ''#8B5CF6'',
  ''Assessment'':  ''#E8A838'',
}

export default function Clients() {
  return (
    <div className="clients">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">4 active engagements</p>
        </div>
        <button className="btn-primary">+ New Client</button>
      </div>

      <div className="clients-table">
        <div className="table-header">
          <div>Client</div>
          <div>Advisor</div>
          <div>Session</div>
          <div>Status</div>
          <div>Maturity Score</div>
        </div>
        {CLIENTS.map(c => (
          <div key={c.name} className="table-row">
            <div className="client-cell">
              <div className="client-avatar-sm">{c.initials}</div>
              <span>{c.name}</span>
            </div>
            <div className="cell-muted">{c.advisor}</div>
            <div className="cell-muted">Session {c.session}</div>
            <div>
              <span className="status-badge" style={{background: STATUS_COLORS[c.status]+''22'', color: STATUS_COLORS[c.status]}}>
                {c.status}
              </span>
            </div>
            <div>
              {c.score
                ? <div className="score-display"><div className="score-bar-sm"><div className="score-fill-sm" style={{width:`${(c.score/5)*100}%`}} /></div><span>{c.score}/5</span></div>
                : <span className="cell-muted">â€”</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

