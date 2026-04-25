import { Outlet, NavLink, useLocation } from ''react-router-dom''
import {
  LayoutDashboard, ClipboardCheck, BarChart3,
  Users, Shield, AlertTriangle, Lightbulb, Settings, Zap
} from ''lucide-react''
import AIChat from ''./AIChat.jsx''
import ''./Layout.css''

const pillars = [
  { id: ''governance'',  label: ''Governance'',       color: ''#4A9FE0'', icon: Shield },
  { id: ''risk'',        label: ''Risk & Compliance'', color: ''#E8A838'', icon: AlertTriangle },
  { id: ''strategy'',    label: ''AI Strategy'',       color: ''#8B5CF6'', icon: Lightbulb },
  { id: ''operations'',  label: ''Operations'',        color: ''#3DBA7E'', icon: Settings },
  { id: ''enablement'',  label: ''Enablement'',        color: ''#EC4899'', icon: Zap },
]

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">Z</div>
          <div>
            <div className="logo-name">Zones</div>
            <div className="logo-sub">AI Advisory</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          <NavLink to="/dashboard" className={({isActive}) => isActive ? ''nav-item active'' : ''nav-item''}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/clients" className={({isActive}) => isActive ? ''nav-item active'' : ''nav-item''}>
            <Users size={15} /> Clients
          </NavLink>

          <div className="nav-section-label" style={{marginTop:16}}>Framework Pillars</div>
          {pillars.map(p => (
            <NavLink
              key={p.id}
              to={`/assessment/${p.id}`}
              className={({isActive}) => isActive ? ''nav-item active'' : ''nav-item''}
            >
              <span className="pillar-dot" style={{background: p.color}} />
              {p.label}
            </NavLink>
          ))}

          <div className="nav-section-label" style={{marginTop:16}}>Outputs</div>
          <NavLink to="/results" className={({isActive}) => isActive ? ''nav-item active'' : ''nav-item''}>
            <BarChart3 size={15} /> Results & Roadmap
          </NavLink>
          <NavLink to="/assessment" className={({isActive}) => isActive ? ''nav-item active'' : ''nav-item''}>
            <ClipboardCheck size={15} /> Full Assessment
          </NavLink>
        </nav>

        <div className="sidebar-client">
          <div className="client-avatar">AC</div>
          <div>
            <div className="client-name">Acme Corp</div>
            <div className="client-stage">Session 3 Â· In Progress</div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <div className="chat-panel-wrapper">
        <AIChat />
      </div>
    </div>
  )
}

