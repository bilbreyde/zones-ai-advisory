import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../ClientContext.jsx'
import { CheckCircle, AlertCircle, Edit2, ChevronDown, ChevronUp, Users, Settings } from 'lucide-react'
import { BASE_QUESTIONS, getEnvironmentQuestions, PILLAR_META } from '../pages/assessmentData.js'
import EnvironmentProfile from './EnvironmentProfile.jsx'
import './AssessmentReview.css'

const API = import.meta.env.VITE_API_URL || ''

export default function AssessmentReview() {
  const { client, setClient } = useClient()
  const navigate = useNavigate()

  // Compute environment-aware questions
  const envQ = getEnvironmentQuestions(client?.environmentProfile)
  const ACTIVE_QUESTIONS = {
    governance:  [...BASE_QUESTIONS.governance,  ...envQ.governance],
    risk:        [...BASE_QUESTIONS.risk,        ...envQ.risk],
    strategy:    [...BASE_QUESTIONS.strategy,    ...envQ.strategy],
    operations:  [...BASE_QUESTIONS.operations,  ...envQ.operations],
    enablement:  [...BASE_QUESTIONS.enablement,  ...envQ.enablement],
  }
  const TOTAL_QUESTIONS = Object.values(ACTIVE_QUESTIONS).reduce((s, qs) => s + qs.length, 0)

  const [assessment, setAssessment]     = useState(null)
  const [loading, setLoading]           = useState(true)
  const [expanded, setExpanded]         = useState({ governance: true, risk: true, strategy: true, operations: true, enablement: true })
  const [editingQ, setEditingQ]         = useState(null)  // { pillar, questionId }
  const [saving, setSaving]             = useState(null)  // questionId currently saving
  const [showEnvModal, setShowEnvModal] = useState(!client?.environmentProfile)

  useEffect(() => {
    if (!client?.id) { setLoading(false); return }
    setLoading(true)
    fetch(`${API}/api/assessments/${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setAssessment(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [client?.id])

  async function updateAnswer(pillar, questionId, answer) {
    setSaving(questionId)
    try {
      const res = await fetch(`${API}/api/assessments/${client.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar, questionId, answer }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAssessment(updated)
        setEditingQ(null)
      }
    } catch (err) {
      console.error('Failed to save answer:', err)
    } finally {
      setSaving(null)
    }
  }

  if (!client) {
    return (
      <div className="review-empty">
        <Users size={28} style={{ color: 'var(--z-muted)', marginBottom: 8 }} />
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--z-white)', marginBottom: 4 }}>No client selected</div>
        <div style={{ fontSize: 12, color: 'var(--z-muted)', marginBottom: 16 }}>Select a client to view their assessment.</div>
        <button className="review-btn-primary" onClick={() => navigate('/clients')}>Go to Clients</button>
      </div>
    )
  }

  if (loading) {
    return <div className="review-loading">Loading assessment…</div>
  }

  const answers = assessment?.answers || {}

  const answeredCount = Object.values(answers).reduce(
    (sum, pillarAnswers) => sum + Object.keys(pillarAnswers || {}).length,
    0
  )

  const completionPct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100)

  function handleEnvComplete(updated) {
    setClient(updated)
    setShowEnvModal(false)
  }

  return (
    <div className="assessment-review">
      {/* Environment Profile modal */}
      {showEnvModal && client && (
        <EnvironmentProfile
          client={client}
          onComplete={handleEnvComplete}
          onSkip={() => setShowEnvModal(false)}
        />
      )}

      {/* Header */}
      <div className="review-header">
        <div>
          <h1 className="review-title">Assessment Review</h1>
          <div className="review-sub">
            {client.name}
            {' · '}
            <span style={{ color: answeredCount === TOTAL_QUESTIONS ? '#3DBA7E' : 'var(--z-muted)' }}>
              {answeredCount}/{TOTAL_QUESTIONS} questions answered
            </span>
            {assessment?.updatedAt && (
              <> · Last updated {new Date(assessment.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="review-progress-wrap">
            <div className="review-progress-bar">
              <div
                className="review-progress-fill"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="review-progress-label">{completionPct}% complete</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            className="review-btn-secondary"
            style={{ fontSize: 11, padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setShowEnvModal(true)}
            title="Edit environment profile"
          >
            <Settings size={12} /> Environment Profile
          </button>
          <div className="review-score-badge">
            <div className="rsb-num">
              {assessment?.overallScore ?? '—'}
              <span>/5</span>
            </div>
            <div className="rsb-label">Overall Score</div>
            {assessment?.overallScore && (
              <div className="rsb-stage">{maturityStage(assessment.overallScore)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Pillar sections */}
      <div className="review-pillars">
        {PILLAR_META.map(pillar => {
          const pillarAnswers = answers[pillar.id] || {}
          const questions     = ACTIVE_QUESTIONS[pillar.id] || []
          const answeredHere  = Object.keys(pillarAnswers).length
          const pillarScore   = assessment?.scores?.[pillar.id]
          const isExpanded    = expanded[pillar.id]
          const isComplete    = answeredHere === questions.length && questions.length > 0

          return (
            <div key={pillar.id} className="pillar-section">
              {/* Pillar header — click to expand/collapse */}
              <div
                className="pillar-section-header"
                style={{ borderLeft: `3px solid ${pillar.color}` }}
                onClick={() => setExpanded(e => ({ ...e, [pillar.id]: !e[pillar.id] }))}
              >
                <div className="psh-left">
                  <div className="psh-name" style={{ color: pillar.color }}>{pillar.label}</div>
                  <div className="psh-meta">
                    <span>{answeredHere}/{questions.length} answered</span>
                    {isComplete
                      ? <span className="psh-badge psh-complete"><CheckCircle size={11} /> Complete</span>
                      : answeredHere > 0
                        ? <span className="psh-badge psh-partial"><AlertCircle size={11} /> In progress</span>
                        : <span className="psh-badge psh-empty">Not started</span>
                    }
                  </div>
                </div>

                <div className="psh-right">
                  {pillarScore != null && (
                    <div className="psh-score" style={{ color: pillar.color }}>
                      {pillarScore}/5
                    </div>
                  )}
                  <div className="psh-score-bar">
                    <div
                      className="psh-score-fill"
                      style={{ width: `${((pillarScore || 0) / 5) * 100}%`, background: pillar.color }}
                    />
                  </div>
                  <button
                    className="psh-edit-btn"
                    onClick={e => { e.stopPropagation(); navigate(`/assessment/${pillar.id}`) }}
                    title={`Edit all ${pillar.label} questions`}
                  >
                    <Edit2 size={11} /> Edit all
                  </button>
                  {isExpanded
                    ? <ChevronUp size={15} className="psh-chevron" />
                    : <ChevronDown size={15} className="psh-chevron" />
                  }
                </div>
              </div>

              {/* Question rows */}
              {isExpanded && (
                <div className="pillar-questions">
                  {questions.map((q, qi) => {
                    const currentAnswer = pillarAnswers[q.id]
                    const isEditing     = editingQ?.pillar === pillar.id && editingQ?.questionId === q.id
                    const isSaving      = saving === q.id

                    return (
                      <div
                        key={q.id}
                        className={`review-question${!currentAnswer ? ' unanswered' : ''}`}
                      >
                        <div className="rq-num">{qi + 1}</div>
                        <div className="rq-content">
                          <div className="rq-text">{q.text}</div>

                          {isEditing ? (
                            <div className="rq-options">
                              {q.options.map(opt => (
                                <button
                                  key={opt}
                                  className={`rq-opt${currentAnswer === opt ? ' current' : ''}`}
                                  style={currentAnswer === opt
                                    ? { borderColor: pillar.color, background: pillar.color + '22', color: pillar.color }
                                    : {}
                                  }
                                  onClick={() => updateAnswer(pillar.id, q.id, opt)}
                                  disabled={isSaving}
                                >
                                  {isSaving && currentAnswer !== opt ? opt : opt}
                                </button>
                              ))}
                              <button className="rq-cancel" onClick={() => setEditingQ(null)}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="rq-answer-row">
                              {currentAnswer ? (
                                <span
                                  className="rq-answer"
                                  style={{ background: pillar.color + '20', color: pillar.color, borderColor: pillar.color + '44' }}
                                >
                                  {currentAnswer}
                                </span>
                              ) : (
                                <span className="rq-unanswered">Not answered</span>
                              )}
                              <button
                                className="rq-change"
                                onClick={() => setEditingQ({ pillar: pillar.id, questionId: q.id })}
                              >
                                {currentAnswer ? 'Change' : 'Answer'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="review-footer">
        <button className="review-btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <button className="review-btn-primary" onClick={() => navigate('/results')}>
          View Results & Roadmap →
        </button>
      </div>
    </div>
  )
}

function maturityStage(score) {
  if (score >= 4.5) return 'AI Leader'
  if (score >= 3.5) return 'AI Mature'
  if (score >= 2.5) return 'AI Enabled'
  if (score >= 1.5) return 'AI Aware'
  return 'AI Unaware'
}
