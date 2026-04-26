import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle, Users } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import './Assessment.css'

const API = import.meta.env.VITE_API_URL || ''

const QUESTIONS = {
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

const PILLAR_COLORS = {
  governance:'#4A9FE0', risk:'#E8A838', strategy:'#8B5CF6', operations:'#3DBA7E', enablement:'#EC4899'
}

const PILLAR_LABELS = {
  governance:'Governance', risk:'Risk & Compliance', strategy:'AI Strategy', operations:'Operations', enablement:'Enablement'
}

const ALL_PILLARS = ['governance','risk','strategy','operations','enablement']

export default function Assessment() {
  const { pillar } = useParams()
  const navigate = useNavigate()
  const { client } = useClient()

  const activePillar = pillar && QUESTIONS[pillar] ? pillar : 'risk'
  const questions = QUESTIONS[activePillar]
  const color = PILLAR_COLORS[activePillar]

  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})

  // Load existing answers from Cosmos when client changes
  useEffect(() => {
    if (!client) return
    setAnswers({})
    fetch(`${API}/api/assessments/${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.answers) return
        // Flatten { governance: { g1: 'X' }, risk: { r1: 'Y' }, ... } → { g1: 'X', r1: 'Y', ... }
        const flat = {}
        for (const pillarAnswers of Object.values(data.answers)) {
          Object.assign(flat, pillarAnswers)
        }
        setAnswers(flat)
      })
      .catch(() => {})
  }, [client?.id])

  if (!client) {
    return (
      <div className="assessment">
        <div className="no-client-assessment">
          <Users size={32} style={{color:'var(--z-muted)'}} />
          <h2>No client selected</h2>
          <p>Go to the Clients page and select a client to begin the assessment.</p>
          <button className="btn-nav next" style={{background:'var(--z-blue)'}} onClick={() => navigate('/clients')}>
            Go to Clients <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  const q = questions[currentQ]
  const answered = answers[q.id]

  async function select(option) {
    setAnswers(prev => ({ ...prev, [q.id]: option }))
    // Fire-and-forget save to Cosmos
    try {
      await fetch(`${API}/api/assessments/${client.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar: activePillar, questionId: q.id, answer: option }),
      })
    } catch {}
  }

  function next() {
    if (currentQ < questions.length - 1) setCurrentQ(c => c + 1)
    else navigate('/results')
  }

  function prev() {
    if (currentQ > 0) setCurrentQ(c => c - 1)
  }

  return (
    <div className="assessment">
      <div className="assessment-header">
        <div>
          <h1 className="page-title" style={{color}}>
            {PILLAR_LABELS[activePillar]}
          </h1>
          <p className="page-sub">{client.name} · Question {currentQ + 1} of {questions.length}</p>
        </div>
        <div className="pillar-tabs">
          {ALL_PILLARS.map(p => (
            <button
              key={p}
              className={`pillar-tab ${p === activePillar ? 'active' : ''}`}
              style={p === activePillar ? {borderColor: PILLAR_COLORS[p], color: PILLAR_COLORS[p]} : {}}
              onClick={() => { navigate(`/assessment/${p}`); setCurrentQ(0) }}
            >
              {PILLAR_LABELS[p].split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{width:`${((currentQ + (answered ? 1 : 0)) / questions.length) * 100}%`, background: color}}
        />
      </div>

      <div className="question-area">
        <div className="question-card">
          <div className="question-meta">
            <span className="question-pillar" style={{color, background: color+'22'}}>{PILLAR_LABELS[activePillar]}</span>
            <span className="question-num">{currentQ + 1} / {questions.length}</span>
          </div>

          <div className="question-text">{q.text}</div>

          <div className="options-grid">
            {q.options.map((opt, i) => (
              <button
                key={opt}
                className={`option-btn ${answered === opt ? 'selected' : ''}`}
                style={answered === opt ? {borderColor: color, background: color+'18'} : {}}
                onClick={() => select(opt)}
              >
                <div className="option-level">Level {i + 1}</div>
                <div className="option-label">{opt}</div>
                {answered === opt && <CheckCircle size={14} style={{color, marginLeft:'auto', flexShrink:0}} />}
              </button>
            ))}
          </div>
        </div>

        <div className="question-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-title">Maturity Levels</div>
            {['Not started','In progress','Implemented','Optimized'].map((l, i) => (
              <div key={l} className="maturity-row">
                <div className="maturity-num">{i+1}</div>
                <div className="maturity-label">{l}</div>
              </div>
            ))}
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-title">Pillar Progress</div>
            {ALL_PILLARS.map(p => {
              const qs = QUESTIONS[p]
              const done = qs.filter(q => answers[q.id]).length
              return (
                <div key={p} className="pillar-progress-row">
                  <div className="pp-label" style={{color: PILLAR_COLORS[p]}}>{PILLAR_LABELS[p].split(' ')[0]}</div>
                  <div className="pp-bar">
                    <div className="pp-fill" style={{width:`${(done/qs.length)*100}%`, background:PILLAR_COLORS[p]}} />
                  </div>
                  <div className="pp-count">{done}/{qs.length}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="assessment-footer">
        <button className="btn-nav" onClick={prev} disabled={currentQ === 0}>
          <ChevronLeft size={16} /> Previous
        </button>
        <div className="footer-dots">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`dot ${i === currentQ ? 'active' : answers[questions[i].id] ? 'done' : ''}`}
              style={i === currentQ ? {background:color} : answers[questions[i].id] ? {background:color+'66'} : {}}
              onClick={() => setCurrentQ(i)}
            />
          ))}
        </div>
        <button className="btn-nav next" onClick={next} disabled={!answered} style={{background: answered ? color : undefined}}>
          {currentQ === questions.length - 1 ? 'Finish Pillar' : 'Next'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
