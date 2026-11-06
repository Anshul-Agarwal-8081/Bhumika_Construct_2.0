import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

const userA = { email: process.env.LEARNING_TEST_USER_A_EMAIL, password: process.env.LEARNING_TEST_USER_A_PASSWORD }
const userB = { email: process.env.LEARNING_TEST_USER_B_EMAIL, password: process.env.LEARNING_TEST_USER_B_PASSWORD }
const credentialsPresent = Boolean(userA.email && userA.password && userB.email && userB.password)

type ApiResponse = { status: number; body: any }
async function request(base: string, path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<ApiResponse> {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.body ? { 'content-type': 'application/json' } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  return { status: response.status, body: response.status === 204 ? null : await response.json().catch(() => null) }
}

function assertLoginSucceeded(stage: 'User A login' | 'User B login', response: ApiResponse): void {
  if (response.status !== 200) {
    const responseMessage = typeof response.body?.error?.message === 'string'
      ? response.body.error.message.replace(/[\r\n\t]/g, ' ').slice(0, 160)
      : 'No sanitized error message returned'
    console.error(`[integration] stage="${stage}" status=${response.status} message="${responseMessage}"`)
  }
  assert.equal(response.status, 200, `${stage} failed with HTTP ${response.status}; see sanitized auth diagnostics above`)
}

function assertRefreshSucceeded(response: ApiResponse, refreshToken: unknown): void {
  if (response.status !== 200) {
    const code = typeof response.body?.error?.code === 'string' ? response.body.error.code : 'UNKNOWN'
    const rawMessage = typeof response.body?.error?.message === 'string' ? response.body.error.message : ''
    const message = /valid refresh token is required/i.test(rawMessage)
      ? 'Refresh token payload was rejected by Bhūmikā validation'
      : /session expired|invalid|expired/i.test(rawMessage)
        ? 'Supabase rejected or could not restore the refresh token'
        : 'No sanitized refresh error message returned'
    const tokenLength = typeof refreshToken === 'string' ? refreshToken.length : 0
    console.error(`[integration] stage="User B refresh" status=${response.status} code=${code} message="${message}" refreshTokenPresent=${tokenLength > 0} refreshTokenLength=${tokenLength}`)
  }
  assert.equal(response.status, 200, `User B refresh failed with HTTP ${response.status}; see sanitized refresh diagnostics above`)
}

test('real two-user Supabase, Tavily, YouTube, Gemini and learning persistence flow', { skip: !credentialsPresent && 'Set LEARNING_TEST_USER_A_EMAIL/PASSWORD and LEARNING_TEST_USER_B_EMAIL/PASSWORD to run live integration tests.', timeout: 180_000 }, async (t) => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}/api`
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

  let tokenA = ''
  let tokenB = ''
  let resourceId = ''
  let resourceIdB = ''
  let roadmapId = ''
  try {
    const invalidLogin = await request(base, '/auth/login', { method: 'POST', body: { email: userA.email, password: `${userA.password}wrong` } })
    assert.equal(invalidLogin.status, 401, 'incorrect credentials should be rejected by Supabase')

    const loginA = await request(base, '/auth/login', { method: 'POST', body: userA })
    const loginB = await request(base, '/auth/login', { method: 'POST', body: userB })
    assertLoginSucceeded('User A login', loginA)
    assertLoginSucceeded('User B login', loginB)
    tokenA = loginA.body.session.access_token
    tokenB = loginB.body.session.access_token
    assert.ok(tokenA && tokenB)

    const refreshTokenB = loginB.body?.session?.refresh_token
    assert.ok(typeof refreshTokenB === 'string' && refreshTokenB.length >= 12 && refreshTokenB.length <= 2048, 'User B login response should include a Supabase refresh token at session.refresh_token')
    const refreshB = await request(base, '/auth/refresh', { method: 'POST', body: { refresh_token: refreshTokenB } })
    assertRefreshSucceeded(refreshB, refreshTokenB)
    tokenB = refreshB.body.session.access_token

    assert.equal((await request(base, '/auth/me', { token: tokenA })).status, 200, 'session restoration should validate the token')
    assert.equal((await request(base, '/auth/me', { token: 'invalid.expired.token' })).status, 401)
    assert.equal((await request(base, '/learning/saved')).status, 401)

    const health = await request(base, '/health')
    assert.equal(health.status, 200)
    const search = await request(base, '/learning/search', { method: 'POST', token: tokenA, body: { query: 'React.js' } })
    assert.equal(search.status, 200)
    const resources = search.body.resources as { id: string; url: string; type: string; title: string; source: string }[]
    assert.ok(resources.some((resource) => resource.type === 'Video'), 'live YouTube search should return a video')
    assert.ok(resources.some((resource) => resource.type !== 'Video'), 'live Tavily search should return a web result')

    const currentSaved = await request(base, '/learning/saved', { token: tokenA })
    const currentSavedB = await request(base, '/learning/saved', { token: tokenB })
    const candidate = resources.find((resource) =>
      !(currentSaved.body.resources as { resource: { url: string } }[]).some((entry) => entry.resource.url === resource.url) &&
      !(currentSavedB.body.resources as { resource: { url: string } }[]).some((entry) => entry.resource.url === resource.url),
    )
    assert.ok(candidate, 'Both test users need one unused live resource URL for the cleanup test')
    const save = await request(base, '/learning/save', { method: 'POST', token: tokenA, body: { resource: candidate } })
    assert.ok(save.status === 201 || save.status === 200)
    resourceId = save.body.saved.id
    const saveB = await request(base, '/learning/save', { method: 'POST', token: tokenB, body: { resource: candidate } })
    assert.ok(saveB.status === 201 || saveB.status === 200)
    resourceIdB = saveB.body.saved.id
    assert.ok((await request(base, '/learning/saved', { token: tokenA })).body.resources.some((entry: { id: string }) => entry.id === resourceId))
    assert.ok((await request(base, '/learning/saved', { token: tokenB })).body.resources.some((entry: { id: string }) => entry.id === resourceIdB))
    assert.equal((await request(base, '/learning/saved', { token: tokenA })).body.resources.some((entry: { id: string }) => entry.id === resourceIdB), false)
    assert.equal((await request(base, `/learning/save/${resourceIdB}`, { method: 'DELETE', token: tokenA })).status, 404)
    assert.equal((await request(base, `/learning/save/${resourceId}`, { method: 'DELETE', token: tokenB })).status, 404)

    const generated = await request(base, '/learning/roadmap', { method: 'POST', token: tokenA, body: { query: 'React.js', level: 'Beginner' } })
    assert.equal(generated.status, 201, 'live Gemini generation should create a roadmap')
    const roadmap = generated.body.roadmap as { id: string; title: string; difficulty: string; estimatedTotalDuration: string; topics: { id: string; title: string; explanation: string; objective: string; estimatedTime: string; resourceIds: string[]; practiceSuggestions: string[]; miniProject: string; completed: boolean }[] }
    const roadmapResources = generated.body.resources as typeof resources
    roadmapId = roadmap.id
    assert.ok(roadmap.title && roadmap.difficulty && roadmap.estimatedTotalDuration)
    assert.ok(roadmap.topics.length >= 5)
    assert.ok(roadmap.topics.every((topic) => topic.title && topic.explanation && topic.objective && topic.estimatedTime && topic.practiceSuggestions.length && topic.miniProject && !topic.completed))
    assert.ok(roadmap.topics.flatMap((topic) => topic.resourceIds).every((id) => roadmapResources.some((resource) => resource.id === id)))

    assert.equal((await request(base, `/learning/roadmaps/${roadmapId}`, { token: tokenB })).status, 404)
    assert.equal((await request(base, `/learning/roadmaps/${roadmapId}`, { method: 'DELETE', token: tokenB })).status, 404)
    const topic = roadmap.topics[0]
    assert.equal((await request(base, `/learning/topics/${topic.id}/progress`, { method: 'PATCH', token: tokenB, body: { roadmapId, completed: true } })).status, 404)

    const complete = await request(base, `/learning/topics/${topic.id}/progress`, { method: 'PATCH', token: tokenA, body: { roadmapId, completed: true } })
    assert.equal(complete.status, 200)
    assert.equal(complete.body.roadmap.topics.find((entry: { id: string }) => entry.id === topic.id).completed, true)
    const reopened = await request(base, `/learning/roadmaps/${roadmapId}`, { token: tokenA })
    assert.equal(reopened.body.roadmap.topics.find((entry: { id: string }) => entry.id === topic.id).completed, true)
    assert.equal((reopened.body.resources as { id: string }[]).some((entry) => topic.resourceIds.includes(entry.id)), true)
    assert.equal((await request(base, '/learning/roadmaps', { token: tokenB })).body.roadmaps.some((entry: { id: string }) => entry.id === roadmapId), false)

    assert.equal((await request(base, '/auth/logout', { method: 'POST', token: tokenA })).status, 204)
    const loginAgain = await request(base, '/auth/login', { method: 'POST', body: userA })
    assert.equal(loginAgain.status, 200)
    tokenA = loginAgain.body.session.access_token
    assert.ok((await request(base, '/learning/saved', { token: tokenA })).body.resources.some((entry: { id: string }) => entry.id === resourceId))
    assert.ok((await request(base, '/learning/roadmaps', { token: tokenA })).body.roadmaps.some((entry: { id: string; topics: { id: string; completed: boolean }[] }) => entry.id === roadmapId && entry.topics.some((stage) => stage.id === topic.id && stage.completed)))

    assert.equal((await request(base, `/learning/roadmaps/${roadmapId}`, { method: 'DELETE', token: tokenA })).status, 204)
    roadmapId = ''
    assert.equal((await request(base, `/learning/save/${resourceId}`, { method: 'DELETE', token: tokenA })).status, 204)
    resourceId = ''
    assert.equal((await request(base, `/learning/save/${resourceIdB}`, { method: 'DELETE', token: tokenB })).status, 204)
    resourceIdB = ''
    assert.equal((await request(base, '/learning/saved', { token: tokenA })).body.resources.some((entry: { id: string }) => entry.id === save.body.saved.id), false)

    assert.equal((await request(base, '/auth/logout', { method: 'POST', token: tokenA })).status, 204)
    tokenA = ''
    assert.equal((await request(base, '/auth/me', { token: loginA.body.session.access_token })).status, 401)
  } finally {
    if (roadmapId && tokenA) await request(base, `/learning/roadmaps/${roadmapId}`, { method: 'DELETE', token: tokenA }).catch(() => undefined)
    if (resourceId && tokenA) await request(base, `/learning/save/${resourceId}`, { method: 'DELETE', token: tokenA }).catch(() => undefined)
    if (resourceIdB && tokenB) await request(base, `/learning/save/${resourceIdB}`, { method: 'DELETE', token: tokenB }).catch(() => undefined)
  }
})
