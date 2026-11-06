import type { Challenge, Evaluation, RubricResult } from '../types'

// Demo adapter: replace this deterministic function with a server-side model call.
// Keep provider credentials on the server and validate the structured response here.
export function evaluateAnswer(challenge: Challenge, answer: string): Evaluation {
  if (challenge.type === 'multiple-choice') {
    const correct = answer === challenge.answer
    return {
      score: correct ? 100 : 0,
      rubric: [{ label: 'Correct selection', score: correct ? 10 : 0, max: 10, reason: correct ? 'Correct: this handles the failure and guarantees the loading state ends.' : 'Not quite: the interface needs an explicit error state, and loading should end even when the request fails.' }],
      strengths: correct ? ['You chose an approach that gives the user clear feedback when a request fails.'] : ['You completed the check and can review why the other options leave the interface in an unclear state.'],
      gaps: correct ? ['Consider which recovery action would help the user try again.'] : ['Handle the rejected request, show an error state, and clear loading in a finally block.'],
      modelAnswer: 'Use try/catch/finally: catch the rejection to set a helpful error message, and finally set loading to false. The user can then retry without being left at a permanent spinner.',
      nextTask: challenge.followUp,
      caveat: 'This was an objective demo quiz with a fixed answer key. It is a practice check, not a hiring assessment.',
    }
  }
  const clean = answer.trim()
  const lower = clean.toLowerCase()
  const wordCount = clean.split(/\s+/).filter(Boolean).length
  const termsByChallenge: Record<string, string[]> = {
    'loading-states': ['loading', 'empty', 'error', 'success', 'retry', 'screen reader', 'aria', 'status'],
    'async-search': ['cancel', 'abort', 'request id', 'latest', 'race', 'sequence', 'stale'],
    'react-list': ['key', 'index', 'id', 'stable', 'identity', 'render'],
    'sql-aggregation': ['join', 'distinct', 'count', 'grain', 'group', 'aggregate', 'items'],
    'sql-join-review': ['left join', 'left', 'null', 'coalesce', 'zero', 'filter', 'where'],
    'metric-drop': ['conversion', 'caus', 'segment', 'experiment', 'check', 'baseline', 'hypothesis'],
    'array-pair': ['array', 'hash', 'map', 'lookup', 'time', 'space', 'duplicate', 'empty', 'no pair'],
    'api-design': ['endpoint', 'validation', 'authentication', 'status', 'error', 'conflict', 'version'],
    'oop-library': ['class', 'member', 'book', 'copy', 'responsibility', 'composition', 'inheritance', 'borrow'],
    'behavioral-setback': ['situation', 'action', 'result', 'learn', 'contribution', 'specific'],
  }
  const detected = termsByChallenge[challenge.id] ?? []
  const hits = detected.filter((term) => lower.includes(term))
  const specificity = Math.min(1, hits.length / Math.max(3, Math.ceil(detected.length * 0.45)))
  const completeness = Math.min(1, wordCount / 85)
  const base = wordCount < 12 ? 20 : 38
  const score = Math.min(96, Math.max(18, Math.round(base + specificity * 43 + completeness * 18)))
  const rubric: RubricResult[] = challenge.rubric.map((item, index) => {
    const share = index === 0 ? Math.min(1, hits.length / 3) : index === 1 ? Math.min(1, hits.length / 5) : Math.min(1, completeness * 1.2)
    const points = Math.round(share * item.max)
    return { label: item.label, score: points, max: item.max, reason: `${points === item.max ? 'Covered well' : points > 0 ? 'Partly covered' : 'Not yet evidenced'}: ${item.hint}` }
  })
  const strengths = hits.length
    ? [`You mentioned ${hits.slice(0, 3).join(', ')}, which are relevant to this scenario.`, wordCount >= 60 ? 'You gave enough detail to make your reasoning reviewable.' : 'You kept the response focused on the problem.']
    : ['You attempted the scenario and stated an initial direction.']
  const missing = detected.filter((term) => !lower.includes(term))
  const gaps = [
    ...(missing.length ? [`Add evidence about ${missing.slice(0, 3).join(', ')}.`] : []),
    ...(wordCount < 50 ? ['Explain how you would verify the fix, not only what you would change.'] : []),
  ]
  return {
    score,
    rubric,
    strengths,
    gaps: gaps.length ? gaps : ['Add one concrete edge case or validation step to strengthen the answer.'],
    modelAnswer: challenge.id === 'react-list'
      ? 'Use each task’s stable ID as its key. An array index changes when rows are removed, so React may reuse the wrong component state. Verify by checking one row, deleting a different row above it, and confirming the checked state stays with the original task.'
      : challenge.id === 'sql-aggregation'
        ? 'The join creates one output row per order item, so orders with multiple items are counted more than once. Count DISTINCT order_id for orders, or aggregate items by order first. Compare the result with the order table and check the output grain before using it.'
        : 'Name each state the user can encounter, explain the feedback they will receive, and describe how you would verify the behavior with a realistic edge case. Keep observation separate from assumptions and make the next action clear.' ,
    nextTask: challenge.followUp,
    caveat: 'This is deterministic demo feedback based on keyword coverage and answer detail. It is a practice estimate, not an expert judgment.',
  }
}
