import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle, Users } from 'lucide-react'
import { useClient } from '../ClientContext.jsx'
import AssessmentReview from '../components/AssessmentReview.jsx'
import { QUESTIONS, PILLAR_COLORS, PILLAR_LABELS, ALL_PILLARS } from './assessmentData.js'
import './Assessment.css'

const API = import.meta.env.VITE_API_URL || ''

export default function Assessment() {
  const { pillar } = useParams()
  const navigate = useNavigate()
  const { client } = useClient()

  // No pillar in URL → show the full review/summary screen
  if (!pillar) {
    return <AssessmentReview />
  }

  const activePillar = QUESTIONS[pillar] ? pillar : 'governance'
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
  }, [client?.id, activePillar])

  // Reset to Q0 when pillar changes
  useEffect(() => {
    setCurrentQ(0)
  }, [activePillar])

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
    else navigate('/assessment')
  }

  function prev() {
    if (currentQ > 0) setCurrentQ(c => c - 1)
    else navigate('/assessment')
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
              onClick={() => navigate(`/assessment/${p}`)}
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

          <button
            className="btn-nav"
            style={{ justifyContent: 'center', fontSize: 11 }}
            onClick={() => navigate('/assessment')}
          >
            ← Back to Review
          </button>
        </div>
      </div>

      <div className="assessment-footer">
        <button className="btn-nav" onClick={prev}>
          <ChevronLeft size={16} /> {currentQ === 0 ? 'Review' : 'Previous'}
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
        <button className="btn-nav next" onClick={next} style={{background: answered ? color : undefined}}>
          {currentQ === questions.length - 1 ? 'Done' : 'Next'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
