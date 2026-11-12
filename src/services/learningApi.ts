export type LearningResource = { id: string; title: string; description: string; url: string; source: string; type: 'Video'|'Course'|'Article'|'Documentation'|'Practice'; level: 'Beginner'|'Intermediate'|'Advanced'; estimatedTime: string|null; language: string|null; freeAccess: string; reason: string; thumbnail?: string|null; publishedAt?: string|null }
export type Roadmap = { id: string; title: string; query: string; difficulty?: string; estimatedTotalDuration?: string; created_at?: string; updated_at?: string; topics: { id: string; title: string; explanation: string; objective: string; difficulty: string; estimatedTime: string|null; prerequisites: string[]; resourceIds: string[]; practiceSuggestions: string[]; miniProject: string; completed: boolean }[] }

const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '')
const accessTokenKey = 'bhumika_access_token'
const refreshTokenKey = 'bhumika_refresh_token'
type Session = { access_token: string; refresh_token: string }

function saveSession(session?: Session | null) {
  if (!session?.access_token || !session.refresh_token) return
  localStorage.setItem(accessTokenKey, session.access_token)
  localStorage.setItem(refreshTokenKey, session.refresh_token)
}

export function learningClearSession() {
  localStorage.removeItem(accessTokenKey)
  localStorage.removeItem(refreshTokenKey)
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(refreshTokenKey)
  if (!refreshToken) return null
  const response = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.session?.access_token || !body.session.refresh_token) {
    learningClearSession()
    return null
  }
  saveSession(body.session)
  return body.session.access_token as string
}

async function requestWithRefresh<T>(path: string, init: RequestInit, retried: boolean): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  const token = localStorage.getItem(accessTokenKey)
  if (token) headers.set('authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`${base}${path}`, { ...init, headers }) }
  catch { throw new Error('The Bhūmikā API is unreachable. Restart the app with “npm run dev” so the frontend and backend run together, then try again.') }
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  const canRefresh = path !== '/auth/login' && path !== '/auth/register' && path !== '/auth/refresh'
  if (response.status === 401 && !retried && canRefresh && localStorage.getItem(refreshTokenKey)) {
    let refreshed: string | null
    try { refreshed = await refreshAccessToken() }
    catch { throw new Error('The Bhūmikā API is unreachable. Your session is still saved; restart the app with “npm run dev” so the frontend and backend run together, then try again.') }
    if (refreshed) return requestWithRefresh<T>(path, init, true)
  }
  if (!response.ok) throw new Error(body?.error?.message || `Request failed (${response.status}).`)
  return body as T
}

export function learningRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestWithRefresh<T>(path, init, false)
}

export async function learningSignIn(email: string, password: string) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.session?.access_token) throw new Error(body?.error?.message || 'Sign in failed.')
  saveSession(body.session)
  return body.session.access_token as string
}

export async function learningCurrentUser() {
  return learningRequest<{ user: { id: string; email?: string } }>('/auth/me')
}

export async function learningRegister(email: string, password: string) {
  const response = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || 'Registration failed.')
  if (body?.session?.access_token) saveSession(body.session)
  return { signedIn: Boolean(body?.session?.access_token), confirmationRequired: Boolean(body?.confirmationRequired) }
}

export async function learningForgotPassword(email: string) {
  const response = await fetch(`${base}/auth/forgot-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || 'Could not request password recovery.')
  return body as { message: string }
}

export async function learningUpdatePassword(accessToken: string, password: string) {
  const response = await fetch(`${base}/auth/update-password`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ password }) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || 'Could not update your password.')
  return body as { user: { id: string } }
}

export async function learningSignOut() {
  try { await learningRequest('/auth/logout', { method: 'POST' }) } finally { learningClearSession() }
}
