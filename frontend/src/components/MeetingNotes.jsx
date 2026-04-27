import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader, FileText, CheckCircle } from 'lucide-react'
import { PILLAR_COLORS } from '../pages/assessmentData.js'
import './MeetingNotes.css'

const API = import.meta.env.VITE_API_URL || ''

const CHANGE_LABELS = {
  tool_add:          '+ Add tool',
  tool_remove:       '− Remove tool',
  compliance_add:    '+ Add compliance framework',
  compliance_remove: '− Remove compliance framework',
  legacy_add:        '+ Add legacy system',
  legacy_remove:     '− Remove legacy system',
  deployment_change: '⟳ Update deployment model',
  constraint_add:    '+ Add constraint',
}

export default function MeetingNotes({ client, onComplete, onClose }) {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  // Input state
  const [notes,        setNotes]        = useState('')
  const [participants, setParticipants] = useState('')
  const [meetingDate,  setMeetingDate]  = useState(today)
  const [analysing,    setAnalysing]    = useState(false)
  const [error,        setError]        = useState(null)

  // Review state
  const [sessionId,           setSessionId]           = useState(null)
  const [extracted,           setExtracted]           = useState(null)
  const [confirmedProfile,    setConfirmedProfile]    = useState([])
  const [confirmedAssessment, setConfirmedAssessment] = useState([])
  const [sessionNotes,        setSessionNotes]        = useState('')
  const [applying,            setApplying]            = useState(false)

  // Done state
  const [done,    setDone]    = useState(false)
  const [applied, setApplied] = useState(null)

  const stage = done ? 'done' : extracted ? 'review' : 'input'

  async function analyse() {
    setAnalysing(true)
    setError(null)
    try {
      const participantList = participants.split(',').map(p => p.trim()).filter(Boolean)
      const res = await fetch(`${API}/api/clients/${client.id}/meeting-notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notes, participants: participantList, meetingDate }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Analysis failed'); return }
      setSessionId(data.sessionId)
      setExtracted(data.extracted)
      setConfirmedProfile((data.extracted.profileChanges || []).map((_, i) => i))
      setConfirmedAssessment((data.extracted.assessmentChanges || []).map((_, i) => i))
      setSessionNotes(data.extracted.sessionNotes || '')
    } catch {
      setError('Connection error — check the server is running.')
    } finally {
      setAnalysing(false)
    }
  }

  async function applyChanges() {
    setApplying(true)
    setError(null)
    try {
      const profileChanges    = (extracted.profileChanges    || []).filter((_, i) => confirmedProfile.includes(i))
      const assessmentChanges = (extracted.assessmentChanges || []).filter((_, i) => confirmedAssessment.includes(i))
      const res = await fetch(`${API}/api/clients/${client.id}/apply-changes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId,
          confirmedProfileChanges:    profileChanges,
          confirmedAssessmentChanges: assessmentChanges,
          sessionNotes,
        }),
      })
      const updated = await res.json()
      if (!res.ok) { setError(updated.error || 'Apply failed'); return }
      setApplied({ profileCount: profileChanges.length, assessmentCount: assessmentChanges.length })
      setDone(true)
      onComplete(updated)
      setTimeout(() => onClose(), 3000)
    } catch {
      setError('Connection error — could not apply changes.')
    } finally {
      setApplying(false)
    }
  }

  function toggleProfile(i) {
    setConfirmedProfile(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  function toggleAssessment(i) {
    setConfirmedAssessment(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const stageIdx = stage === 'input' ? 0 : stage === 'review' ? 1 : 2

  return (
    <div className="mn-overlay">
      <div className="mn-modal">
        {/* Header */}
        <div className="mn-header">
          <div className="mn-header-left">
            <FileText size={15} />
            <div>
              <div className="mn-title">Meeting Notes</div>
              <div className="mn-sub">{client.name}</div>
            </div>
          </div>
          <button className="mn-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Step indicator */}
        <div className="mn-steps">
          {['Input', 'Review', 'Done'].map((s, i) => (
            <div key={s} className={`mn-step ${i === stageIdx ? 'active' : i < stageIdx ? 'done' : ''}`}>
              <div className="mn-step-dot">{i < stageIdx ? '✓' : i + 1}</div>
              <div className="mn-step-label">{s}</div>
            </div>
          ))}
        </div>

        <div className="mn-body">
          {/* ── INPUT ── */}
          {stage === 'input' && (
            <div className="mn-input-stage">
              <div className="mn-field">
                <label className="mn-label">Meeting Notes / Transcript</label>
                <textarea
                  className="mn-textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Paste meeting transcript or notes here…"
                  rows={10}
                />
              </div>
              <div className="mn-row">
                <div className="mn-field">
                  <label className="mn-label">Participants (comma-separated)</label>
                  <input
                    className="mn-input"
                    value={participants}
                    onChange={e => setParticipants(e.target.value)}
                    placeholder="e.g. Jane Smith, John Doe"
                  />
                </div>
                <div className="mn-field mn-field-sm">
                  <label className="mn-label">Meeting Date</label>
                  <input
                    className="mn-input"
                    type="date"
                    value={meetingDate}
                    onChange={e => setMeetingDate(e.target.value)}
                  />
                </div>
              </div>
              {error && <div className="mn-error">{error}</div>}
              <div className="mn-actions">
                <button className="mn-btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="mn-btn-primary"
                  onClick={analyse}
                  disabled={analysing || notes.trim().length < 50}
                >
                  {analysing
                    ? <><Loader size={13} className="mn-spin" /> Analysing notes…</>
                    : 'Analyse Notes →'
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── REVIEW ── */}
          {stage === 'review' && extracted && (
            <div className="mn-review-stage">
              {/* Summary callout */}
              <div className="mn-summary-card">
                <div className="mn-summary-label">Meeting Summary</div>
                <div className="mn-summary-text">{extracted.summary}</div>
              </div>

              {/* Profile changes */}
              {extracted.profileChanges?.length > 0 && (
                <div className="mn-section">
                  <div className="mn-section-title">
                    Profile Changes ({extracted.profileChanges.length})
                  </div>
                  {extracted.profileChanges.map((change, i) => (
                    <div key={i} className={`proposed-change${confirmedProfile.includes(i) ? ' confirmed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={confirmedProfile.includes(i)}
                        onChange={() => toggleProfile(i)}
                      />
                      <div className="change-content">
                        <div className="change-label">{CHANGE_LABELS[change.type] || change.type}</div>
                        <div className="change-value">{change.proposedValue}</div>
                        {change.currentValue && (
                          <div className="change-current">was: {change.currentValue}</div>
                        )}
                        <div className="change-evidence">"{change.evidence}"</div>
                        <div className={`change-confidence ${change.confidence}`}>{change.confidence} confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Assessment changes */}
              {extracted.assessmentChanges?.length > 0 && (
                <div className="mn-section">
                  <div className="mn-section-title">
                    Assessment Updates ({extracted.assessmentChanges.length})
                  </div>
                  {extracted.assessmentChanges.map((change, i) => (
                    <div key={i} className={`proposed-assessment-change${confirmedAssessment.includes(i) ? ' confirmed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={confirmedAssessment.includes(i)}
                        onChange={() => toggleAssessment(i)}
                      />
                      <div className="pac-content">
                        <div className="pac-pillar" style={{ color: PILLAR_COLORS[change.pillar] }}>
                          {change.pillar}
                        </div>
                        <div className="pac-question">{change.questionText}</div>
                        <div className="pac-answer-flow">
                          <span className="pac-current">{change.currentAnswer || 'Not answered'}</span>
                          <span className="pac-arrow">→</span>
                          <span className="pac-proposed" style={{ color: PILLAR_COLORS[change.pillar] }}>
                            {change.proposedAnswer}
                          </span>
                        </div>
                        <div className="pac-evidence">📄 "{change.evidence}"</div>
                        <div className={`change-confidence ${change.confidence}`}>{change.confidence} confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No changes detected */}
              {!extracted.profileChanges?.length && !extracted.assessmentChanges?.length && (
                <div className="mn-no-changes">
                  No profile or assessment changes were detected in these notes.
                </div>
              )}

              {/* Session notes (editable) */}
              <div className="mn-section">
                <div className="mn-section-title">Session Notes (editable)</div>
                <textarea
                  className="mn-textarea mn-textarea-sm"
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  placeholder="Key points, decisions, and action items…"
                  rows={4}
                />
              </div>

              {error && <div className="mn-error">{error}</div>}
              <div className="mn-actions">
                <button className="mn-btn-secondary" onClick={() => setExtracted(null)}>← Back</button>
                <button
                  className="mn-btn-primary"
                  onClick={applyChanges}
                  disabled={applying}
                >
                  {applying
                    ? <><Loader size={13} className="mn-spin" /> Applying…</>
                    : `Apply Selected Changes (${confirmedProfile.length + confirmedAssessment.length})`
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && applied && (
            <div className="mn-done-stage">
              <div className="mn-done-icon"><CheckCircle size={40} /></div>
              <div className="mn-done-title">Changes Applied</div>
              <div className="mn-done-summary">
                {applied.profileCount > 0 && (
                  <div>{applied.profileCount} environment profile update{applied.profileCount !== 1 ? 's' : ''}</div>
                )}
                {applied.assessmentCount > 0 && (
                  <div>{applied.assessmentCount} assessment answer{applied.assessmentCount !== 1 ? 's' : ''} updated</div>
                )}
                {applied.profileCount === 0 && applied.assessmentCount === 0 && (
                  <div>Session notes saved with no profile changes.</div>
                )}
              </div>
              <div className="mn-done-sub">Closing automatically…</div>
              <button className="mn-btn-primary" onClick={() => { navigate('/assessment'); onClose() }}>
                View Updated Assessment →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
