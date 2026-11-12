import type { Application, ApplicationStatus, ArenaChallenge, Attempt, DemoState, SavedFounderLead } from '../types'

const STORAGE_KEY = 'bhumika-demo-state-v1'
const applicationStatuses: ApplicationStatus[] = ['Draft', 'Ready for review', 'Applied', 'Interview', 'Rejected / Closed']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAttempt(value: unknown): value is Attempt {
  if (!isRecord(value) || !isRecord(value.evaluation)) return false
  return typeof value.id === 'string' && typeof value.challengeId === 'string' && typeof value.roleId === 'string'
    && typeof value.answer === 'string' && typeof value.score === 'number' && Number.isFinite(value.score)
    && typeof value.completedAt === 'string' && typeof value.xp === 'number' && Array.isArray(value.evaluation.rubric)
}

function isApplication(value: unknown): value is Application {
  return isRecord(value) && typeof value.id === 'string' && typeof value.opportunityId === 'string'
    && typeof value.title === 'string' && typeof value.company === 'string'
    && typeof value.status === 'string' && applicationStatuses.includes(value.status as ApplicationStatus)
    && typeof value.updatedAt === 'string'
}

function isArenaChallenge(value: unknown): value is ArenaChallenge {
  return isRecord(value) && typeof value.code === 'string' && typeof value.challengeId === 'string'
    && typeof value.createdAt === 'string' && (value.friendScore === undefined || typeof value.friendScore === 'number')
}

function isSavedFounderLead(value: unknown): value is SavedFounderLead {
  if (!isRecord(value) || !isRecord(value.founder) || !Array.isArray(value.contacts) || typeof value.savedAt !== 'string') return false
  const founder = value.founder
  return typeof founder.founderId === 'string' && typeof founder.founderName === 'string'
    && typeof founder.companySlug === 'string' && typeof founder.companyName === 'string'
}

function textField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function countField(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export const initialState: DemoState = {
  activeRoleId: 'frontend', completedModuleIds: [], attempts: [], xp: 0, streak: 0,
  arenaChallenges: [], applications: [], founderLeads: [],
  profile: { name: '', email: '', education: '', skills: '', projects: '', experience: '', links: '' },
}

export function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return initialState
    const profile = isRecord(parsed.profile) ? parsed.profile : {}
    return {
      activeRoleId: textField(parsed.activeRoleId, initialState.activeRoleId),
      completedModuleIds: Array.isArray(parsed.completedModuleIds) ? parsed.completedModuleIds.filter((item): item is string => typeof item === 'string') : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts.filter(isAttempt) : [],
      xp: countField(parsed.xp, initialState.xp),
      streak: countField(parsed.streak, initialState.streak),
      arenaChallenges: Array.isArray(parsed.arenaChallenges) ? parsed.arenaChallenges.filter(isArenaChallenge) : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications.filter(isApplication) : [],
      founderLeads: Array.isArray(parsed.founderLeads) ? parsed.founderLeads.filter(isSavedFounderLead) : [],
      profile: {
        name: textField(profile.name, initialState.profile.name),
        email: textField(profile.email, initialState.profile.email),
        education: textField(profile.education, initialState.profile.education),
        skills: textField(profile.skills, initialState.profile.skills),
        projects: textField(profile.projects, initialState.profile.projects),
        experience: textField(profile.experience, initialState.profile.experience),
        links: textField(profile.links, initialState.profile.links),
      },
    }
  } catch {
    return initialState
  }
}

export function saveState(state: DemoState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* private browsing may block persistence */ }
}

export function resetState(): DemoState {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore unavailable storage */ }
  return initialState
}
