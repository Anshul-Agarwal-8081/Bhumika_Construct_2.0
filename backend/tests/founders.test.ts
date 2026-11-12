import test from 'node:test'
import assert from 'node:assert/strict'

process.env.RECENT_FUNDING_API_KEY ??= 'test-recent-funding-key'
process.env.RECENT_FUNDING_ON_BEHALF_OF ??= 'Test workspace'

const { searchFundedFounders, getFounderContacts } = await import('../src/services/founders.js')
const { foundersRouter } = await import('../src/routes/founders.js')

const founderRecord = {
  name: 'Asha Rao', role: 'Founder & CEO', slug: 'sample-startup', company: 'Sample Startup',
  company_logo: null, stage: 'seed', amount_usd: 1200000, raised_at: '2026-10-01',
  category: 'fintech', hq_city: 'Bengaluru', profile_url: 'https://recentfunding.com/founders/asha',
  source_url: 'https://example.test/founder-source', linkedin_url: 'https://linkedin.test/asha', x_handle: null,
}

test('founder search applies India and 183-day filters and maps sourced results', async (t) => {
  let requestUrl: URL | undefined
  let requestHeaders: Headers | undefined
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = new URL(input instanceof Request ? input.url : String(input))
    requestHeaders = new Headers(init?.headers)
    return Response.json({ count: 1, founders: [founderRecord] })
  })

  const result = await searchFundedFounders({ query: 'Bengaluru', category: 'fintech', limit: 25 })
  assert.equal(requestUrl?.pathname, '/api/v1/founders')
  assert.equal(requestUrl?.searchParams.get('country'), 'india')
  assert.equal(requestUrl?.searchParams.get('raised'), '183')
  assert.equal(requestUrl?.searchParams.get('q'), 'Bengaluru')
  assert.equal(requestUrl?.searchParams.get('category'), 'fintech')
  assert.equal(requestUrl?.searchParams.get('limit'), '25')
  assert.equal(requestHeaders?.get('authorization'), 'Bearer test-recent-funding-key')
  assert.equal(requestHeaders?.get('x-on-behalf-of'), 'Test workspace')
  assert.deepEqual(result.founders[0], {
    founderId: 'sample-startup:asha rao', founderName: 'Asha Rao', role: 'Founder & CEO', companySlug: 'sample-startup',
    companyName: 'Sample Startup', companyLogo: null, stage: 'seed', amountUsd: 1200000, raisedAt: '2026-10-01',
    category: 'fintech', city: 'Bengaluru', founderUrl: 'https://recentfunding.com/founders/asha',
    personSourceUrl: 'https://example.test/founder-source', linkedinUrl: 'https://linkedin.test/asha', xHandle: null,
  })
})

test('founder contact search keeps only founder and CEO contacts', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ contacts: [
    { name: 'Asha Rao', title: 'Co-founder', role: 'founder', email: 'asha@sample.test', email_status: 'confirmed', linkedin: null, source: 'https://sample.test/team' },
    { name: 'Dev Shah', title: 'Chief Executive Officer', role: 'decision maker', email: 'dev@sample.test', email_status: 'confirmed' },
    { name: 'Ops Lead', title: 'VP Operations', role: 'decision maker', email: 'ops@sample.test', email_status: 'confirmed' },
  ] }))
  const contacts = await getFounderContacts('sample-startup')
  assert.equal(contacts.length, 2)
  assert.deepEqual(contacts.map((contact) => contact.email), ['asha@sample.test', 'dev@sample.test'])
  assert.ok(contacts.every((contact) => /confirmed/i.test(contact.emailStatus)))
})

test('contact route rejects malformed startup identifiers before provider calls', async () => {
  const layer = (foundersRouter as any).stack.find((entry: any) => entry.route?.path === '/:slug/contacts')
  assert.ok(layer)
  const handler = layer.route.stack[0].handle as (req: any, res: any, next: (error?: unknown) => void) => Promise<void>
  const response: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this }, json(body: unknown) { this.body = body; return this } }
  await handler({ params: { slug: 'bad/slug' } }, response, () => assert.fail('Invalid slug must not call next.'))
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error.code, 'VALIDATION_ERROR')
})
