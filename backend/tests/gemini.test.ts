import test from 'node:test'
import assert from 'node:assert/strict'
import { env } from '../src/config/env.js'
import { generateWithGemini } from '../src/config/gemini.js'

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const fail = (status: number, message = 'provider detail must not escape') => new Response(JSON.stringify({ error: { message } }), { status })
function mockFetch(t: test.TestContext, responses: Response[]) {
  const models: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    models.push(decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]))
    const response = responses.shift()
    if (!response) throw new Error('unexpected request')
    return response
  })
  return models
}

test('primary succeeds immediately', async (t) => {
  const models = mockFetch(t, [ok('OK')])
  const result = await generateWithGemini('Reply OK')
  assert.equal(result.text, 'OK')
  assert.equal(result.model, env.GEMINI_MODEL)
  assert.deepEqual(models, [env.GEMINI_MODEL])
})

test('primary retries a transient 503 and succeeds', async (t) => {
  const models = mockFetch(t, [fail(503), ok('Recovered')])
  const result = await generateWithGemini('Reply OK')
  assert.equal(result.text, 'Recovered')
  assert.equal(models.length, 2)
  assert.ok(models.every((model) => model === env.GEMINI_MODEL))
})

test('fallback follows three failed primary attempts', async (t) => {
  const models = mockFetch(t, [fail(503), fail(503), fail(503), ok('Fallback')])
  const result = await generateWithGemini('Reply OK')
  assert.equal(result.model, env.GEMINI_FALLBACK_MODEL)
  assert.equal(models.length, 4)
  assert.deepEqual(models, [env.GEMINI_MODEL, env.GEMINI_MODEL, env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL])
})

test('429 follows the retry policy', async (t) => {
  const models = mockFetch(t, [fail(429), ok('Recovered')])
  assert.equal((await generateWithGemini('Reply OK')).text, 'Recovered')
  assert.equal(models.length, 2)
})

test('explicit Gemini quota exhaustion does not retry or call the fallback model', async (t) => {
  const models = mockFetch(t, [new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for this project.' } }), { status: 429 })])
  await assert.rejects(generateWithGemini('Reply OK'), (error: Error & { statusCode?: number }) => error.message === 'Gemini quota is temporarily unavailable.' && error.statusCode === 503)
  assert.deepEqual(models, [env.GEMINI_MODEL])
})

test('both models fail and return a sanitized error', async (t) => {
  const models = mockFetch(t, [fail(503), fail(503), fail(503), fail(503), fail(503), fail(503)])
  await assert.rejects(generateWithGemini('Reply OK'), /temporarily unavailable/)
  assert.equal(models.length, 6)
})

test('invalid key does not retry or fall back', async (t) => {
  const models = mockFetch(t, [fail(400, env.GEMINI_API_KEY ?? 'secret')])
  await assert.rejects(generateWithGemini('Reply OK'), (error: Error) => !error.message.includes(env.GEMINI_API_KEY ?? 'secret'))
  assert.equal(models.length, 1)
})

test('unsupported primary model makes one fallback request', async (t) => {
  const models = mockFetch(t, [fail(404, 'model not found'), ok('Fallback model response')])
  const result = await generateWithGemini('Reply OK')
  assert.equal(result.model, env.GEMINI_FALLBACK_MODEL)
  assert.equal(result.text, 'Fallback model response')
  assert.deepEqual(models, [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL])
})

test('empty primary response falls back to a valid fallback response', async (t) => {
  const models = mockFetch(t, [new Response(JSON.stringify({ candidates: [] }), { status: 200 }), ok('Recovered')])
  const result = await generateWithGemini('Reply OK')
  assert.equal(result.model, env.GEMINI_FALLBACK_MODEL)
  assert.equal(result.text, 'Recovered')
  assert.equal(models.length, 2)
})

test('invalid structured JSON output falls back and requests JSON mode', async (t) => {
  const models: string[] = []
  const bodies: Record<string, unknown>[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    models.push(decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]))
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return ok(models.length === 1 ? '{"value":"bad"}' : '{"value":7}')
  })
  const result = await generateWithGemini('Return JSON', (text) => {
    const parsed = JSON.parse(text) as { value?: unknown }
    if (typeof parsed.value !== 'number') throw new Error('invalid schema')
    return parsed.value
  }, { type: 'OBJECT', properties: { value: { type: 'INTEGER' } }, required: ['value'] })
  assert.equal(result.model, env.GEMINI_FALLBACK_MODEL)
  assert.equal(result.value, 7)
  assert.equal(models.length, 2)
  assert.equal((bodies[0].generationConfig as { responseMimeType?: string }).responseMimeType, 'application/json')
  assert.equal((bodies[0].generationConfig as { responseSchema?: { type?: string } }).responseSchema?.type, 'OBJECT')
})

test('a one-attempt caller still uses one bounded fallback attempt', async (t) => {
  const models = mockFetch(t, [fail(429), fail(429)])
  await assert.rejects(generateWithGemini('Return JSON', (text) => JSON.parse(text), { type: 'OBJECT' }, { maxAttempts: 1 }), /temporarily unavailable/)
  assert.deepEqual(models, [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL])
})

test('malformed output from both models returns a sanitized error', async (t) => {
  const models = mockFetch(t, [ok('not-json'), ok('still not-json')])
  await assert.rejects(generateWithGemini('Return JSON', (text) => JSON.parse(text)), /valid structured response/)
  assert.equal(models.length, 2)
})
