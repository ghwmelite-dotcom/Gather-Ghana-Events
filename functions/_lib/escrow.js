// "Gather Guarantee" escrow state machine — pure functions, easy to test.
// Funds for a milestone are HELD until the client approves release.

export const ESCROW_STATES = ['none', 'funded', 'release_requested', 'released', 'disputed']

const TRANSITIONS = {
  none: ['funded'],
  funded: ['release_requested', 'released', 'disputed'],
  release_requested: ['released', 'disputed'],
  released: [],
  disputed: ['released', 'funded'],
}

export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to)

// Map an actor action to a target state, or null if not allowed from `current`.
export function applyAction(current, action) {
  const target = {
    fund: 'funded', // a payment funds the milestone
    request_release: 'release_requested', // planner asks
    approve: 'released', // client approves & releases
    dispute: 'disputed', // client raises an issue
  }[action]
  if (!target) return null
  return canTransition(current, target) ? target : null
}

// Held = money still protected; Released = paid out. (minor units)
export function escrowTotals(milestones) {
  let held = 0
  let released = 0
  for (const m of milestones) {
    if (m.escrow_status === 'funded' || m.escrow_status === 'release_requested') held += m.amount || 0
    else if (m.escrow_status === 'released') released += m.amount || 0
  }
  return { held, released }
}
