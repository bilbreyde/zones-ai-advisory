export const STALENESS_THRESHOLDS = {
  assessmentAnswers:    45,
  complianceFrameworks: 60,
  toolingStack:         90,
  overallProfile:       90,
  sessionNotes:         30,
  deploymentModel:      120,
}

export function getDaysSince(dateString) {
  if (!dateString) return null
  return Math.floor((Date.now() - new Date(dateString)) / (1000 * 60 * 60 * 24))
}

export function getStalenessStatus(client, assessment) {
  const results = {}

  const profileUpdated = client?.environmentProfile?.updatedAt
  const profileDays    = getDaysSince(profileUpdated)
  results.overallProfile = {
    daysSince: profileDays,
    threshold: STALENESS_THRESHOLDS.overallProfile,
    isStale:   profileDays !== null && profileDays > STALENESS_THRESHOLDS.overallProfile,
    label:     'Environment profile',
  }

  const assessmentUpdated = assessment?.updatedAt
  const assessmentDays    = getDaysSince(assessmentUpdated)
  results.assessmentAnswers = {
    daysSince: assessmentDays,
    threshold: STALENESS_THRESHOLDS.assessmentAnswers,
    isStale:   assessmentDays !== null && assessmentDays > STALENESS_THRESHOLDS.assessmentAnswers,
    label:     'Assessment answers',
  }

  const lastSession     = client?.sessionHistory?.[0]?.meetingDate
  const sessionDays     = getDaysSince(lastSession)
  results.sessionNotes = {
    daysSince: sessionDays,
    threshold: STALENESS_THRESHOLDS.sessionNotes,
    isStale:   sessionDays !== null && sessionDays > STALENESS_THRESHOLDS.sessionNotes,
    label:     'Last session',
  }

  const mostStale = Object.values(results)
    .filter(r => r.isStale && r.daysSince !== null)
    .sort((a, b) => b.daysSince - a.daysSince)[0]

  return { results, mostStale, anyStale: !!mostStale }
}

export function getCheckInQuestion(client, env) {
  const industry   = client?.industry || ''
  const deployment = env?.deploymentModel
  const compliance = env?.complianceFrameworks || []

  if (industry === 'Healthcare' || compliance.includes('hipaa'))
    return "have there been any changes to their regulatory environment or HIPAA compliance posture?"
  if (industry === 'Financial Services' || compliance.includes('sox'))
    return "have there been any changes to their risk management or compliance requirements?"
  if (deployment === 'on_prem' || deployment === 'hybrid')
    return "have there been any changes to their infrastructure strategy or cloud adoption plans?"
  if (env?.legacySystems?.length > 0)
    return "have there been any updates to their legacy system modernisation plans?"
  return "has anything changed in their AI strategy or tooling stack since the last session?"
}
