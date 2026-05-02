import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, BarChart3,
  Users, Shield, AlertTriangle, Lightbulb, Settings, Zap, HelpCircle, Database
} from 'lucide-react'
import AIChat from './AIChat.jsx'
import EnvironmentProfile from './EnvironmentProfile.jsx'
import { useClient } from '../ClientContext.jsx'
import './Layout.css'
import './EnvironmentProfile.css'

const pillars = [
  { id: 'governance',  label: 'Governance',       color: '#4A9FE0', icon: Shield },
  { id: 'risk',        label: 'Risk & Compliance', color: '#E8A838', icon: AlertTriangle },
  { id: 'strategy',    label: 'AI Strategy',       color: '#8B5CF6', icon: Lightbulb },
  { id: 'operations',  label: 'Operations',        color: '#3DBA7E', icon: Settings },
  { id: 'enablement',  label: 'Enablement',        color: '#EC4899', icon: Zap },
]

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout() {
  const navigate = useNavigate()
  const { client, setClient } = useClient()
  const [showEnvModal, setShowEnvModal] = useState(false)

  return (
    <div className="layout">
      {showEnvModal && client && (
        <EnvironmentProfile
          client={client}
          onComplete={updated => { setClient(updated); setShowEnvModal(false) }}
          onSkip={() => setShowEnvModal(false)}
        />
      )}
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
          <NavLink to="/dashboard" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/clients" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Users size={15} /> Clients
          </NavLink>

          <div className="nav-section-label" style={{marginTop:16}}>Framework Pillars</div>
          {pillars.map(p => (
            <NavLink
              key={p.id}
              to={`/assessment/${p.id}`}
              className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}
            >
              <span className="pillar-dot" style={{background: p.color}} />
              {p.label}
            </NavLink>
          ))}

          <div className="nav-section-label" style={{marginTop:16}}>Outputs</div>
          <NavLink to="/results" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <BarChart3 size={15} /> Results & Roadmap
          </NavLink>
          <NavLink to="/assessment" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <ClipboardList size={15} /> Assessment Review
          </NavLink>
          <NavLink to="/agents" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Zap size={15} /> Agent Studio
          </NavLink>

          <div className="nav-section-label" style={{marginTop:16}}>Compass Modules</div>
          <NavLink to="/data-intelligence" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Database size={15} /> Data Intelligence
          </NavLink>

          <div className="nav-divider" />
          <NavLink to="/help" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <HelpCircle size={15} /> Help & Guide
          </NavLink>
        </nav>

        <div className="sidebar-client-wrap">
          <div className="sidebar-client" onClick={() => navigate('/clients')} title="Switch client">
            {client ? (
              <>
                <div className="client-avatar">{initials(client.name)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="client-name">{client.name}</div>
                  <div className="client-stage">
                    Session {client.currentSession} · {client.status}
                    {client.environmentProfile
                      ? <span className="client-env-dot" title="Environment profile complete" style={{marginLeft:5,color:'#3DBA7E'}}>●</span>
                      : <span className="client-env-dot" title="No environment profile" style={{marginLeft:5,color:'#E8A838'}}>●</span>
                    }
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="client-avatar" style={{background:'var(--z-surface-2)', color:'var(--z-muted)'}}>?</div>
                <div>
                  <div className="client-name" style={{color:'var(--z-muted)'}}>No client selected</div>
                  <div className="client-stage">Click to select</div>
                </div>
              </>
            )}
          </div>
          {client && (
            <button
              className="sidebar-env-btn"
              onClick={e => { e.stopPropagation(); setShowEnvModal(true) }}
              title="Edit environment profile"
            >
              ⚙️
            </button>
          )}
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
