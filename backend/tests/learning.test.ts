import test from 'node:test'
import assert from 'node:assert/strict'
import type { LearningResource } from '../../src/services/learningApi.js'
import { filterLearningResources } from '../../src/services/learningFilters.js'
import { generateRoadmap, learningInternals, searchLearning } from '../src/services/learning.js'

const sample = (id: string, level: LearningResource['level'], estimatedTime: string | null, overrides: Partial<LearningResource> = {}): LearningResource => ({
  id, title: id, description: 'Description', url: `https://example.test/${id}`, source: 'Example', type: 'Article', level,
  estimatedTime, language: null, freeAccess: 'fully_free', reason: '', ...overrides,
})

test('resource filters narrow by source/language and sort by duration and difficulty', () => {
  const resources = [
    sample('advanced', 'Advanced', '2 hours', { source: 'Docs', language: 'English' }),
    sample('beginner', 'Beginner', '30 minutes', { source: 'Video', language: 'Hindi', type: 'Video' }),
    sample('intermediate', 'Intermediate', null, { source: 'Docs', language: null }),
  ]
  const base = { type: 'All types', level: 'All levels', access: 'Any access', source: 'All sources', language: 'All languages' }
  assert.deepEqual(filterLearningResources(resources, { ...base, source: 'Docs', sort: 'Most relevant' }).map((r) => r.id), ['advanced', 'intermediate'])
  assert.deepEqual(filterLearningResources(resources, { ...base, language: 'Hindi', sort: 'Most relevant' }).map((r) => r.id), ['beginner'])
  assert.deepEqual(filterLearningResources(resources, { ...base, sort: 'Shortest duration' }).map((r) => r.id), ['beginner', 'advanced', 'intermediate'])
  assert.deepEqual(filterLearningResources(resources, { ...base, sort: 'Beginner friendly' }).map((r) => r.id), ['beginner', 'intermediate', 'advanced'])
  assert.deepEqual(filterLearningResources(resources, { ...base, sort: 'Advanced' }).map((r) => r.id), ['advanced', 'intermediate', 'beginner'])
  assert.deepEqual(filterLearningResources(resources, { ...base, duration: 'Under 30 minutes' }).map((r) => r.id), [])
  assert.deepEqual(filterLearningResources(resources, { ...base, duration: '30–120 minutes' }).map((r) => r.id), ['advanced', 'beginner'])
  assert.deepEqual(filterLearningResources(resources, { ...base, duration: 'Over 2 hours' }).map((r) => r.id), [])
})

test('roadmap generation parses structured Gemini output and retains only real resource IDs', async (t) => {
  const resource = sample('actual-resource', 'Beginner', '15 minutes')
  const topics = Array.from({ length: 5 }, (_, index) => ({
    title: `Stage ${index + 1}`, explanation: 'Learn the concept.', objective: 'Build understanding.', difficulty: 'Beginner',
    estimatedTime: '1 hour', prerequisites: index ? [`Stage ${index}`] : [], resourceIds: ['actual-resource', 'invented-id'],
    practiceSuggestions: ['Complete a small exercise.'], miniProject: 'Build a small demo.',
  }))
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { generationConfig?: { responseMimeType?: string; responseSchema?: { properties?: { topics?: { minItems?: number; maxItems?: number } } } } }
    assert.equal(payload.generationConfig?.responseMimeType, 'application/json')
    assert.equal(payload.generationConfig?.responseSchema?.properties?.topics?.minItems, 5)
    assert.equal(payload.generationConfig?.responseSchema?.properties?.topics?.maxItems, 7)
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'React Roadmap', topics }) }] } }] }), { status: 200 })
  })
  const roadmap = await generateRoadmap('React', 'Beginner', [resource])
  assert.equal(roadmap.topics.length, 5)
  assert.deepEqual(roadmap.topics[0].resourceIds, ['actual-resource'])
  assert.ok(roadmap.topics.every((topic) => topic.id && topic.objective && topic.difficulty && topic.practiceSuggestions.length && topic.prerequisites))
  assert.equal(roadmap.estimatedTotalDuration, '5 hours')
  assert.equal(roadmap.difficulty, 'Beginner')
})

test('learning search normalizes and deduplicates URLs, preserves provider metadata and ranks real results', async (t) => {
  const videoId = 'dQw4w9WgXcQ'
  const secondVideoId = 'abcdefghijk'
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.tavily.com') return new Response(JSON.stringify({ results: [
      { title: 'React official docs', url: `https://www.youtube.com/watch?v=${videoId}&utm_source=test`, content: 'A useful tutorial.', score: 0.96 },
      { title: 'React reference', url: 'https://react.dev/learn/?utm_source=search', content: 'Official learning docs.', score: 0.87 },
      { title: '', url: 'https://bad.example/empty', content: 'Missing title.' },
      { title: 'Bad scheme', url: 'javascript:alert(1)', content: 'Unsafe URL.' },
    ] }), { status: 200 })
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/search')) return new Response(JSON.stringify({ items: [
      { id: { videoId }, snippet: { title: 'React lesson', channelTitle: 'Learning Channel', description: 'Video details', thumbnails: { medium: { url: 'https://img.example/video.jpg' } }, publishedAt: '2026-01-01T00:00:00Z' } },
      { id: { videoId: secondVideoId }, snippet: { title: 'React metadata-light lesson' } },
      { id: { videoId: 'too-short' }, snippet: { title: 'Invalid video id' } },
      { id: { videoId: 'missingtitl' }, snippet: { channelTitle: 'No title' } },
    ] }), { status: 200 })
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/videos')) return new Response(JSON.stringify({ items: [
      { id: videoId, contentDetails: { duration: 'PT17M' }, snippet: { defaultAudioLanguage: 'en' } },
    ] }), { status: 200 })
    if (url.hostname === 'generativelanguage.googleapis.com') return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }), { status: 200 })
    throw new Error(`Unexpected provider URL: ${url.hostname}${url.pathname}`)
  })

  const result = await searchLearning('React test normalize')
  const videos = result.resources.filter((resource) => resource.type === 'Video')
  assert.equal(result.resources.length, 2)
  assert.equal(videos.length, 1)
  assert.equal(videos[0].url, `https://www.youtube.com/watch?v=${videoId}`)
  assert.match(videos[0].source, /YouTube.*Learning Channel|Learning Channel.*YouTube/)
  assert.equal(videos[0].estimatedTime, '17 minutes')
  assert.equal(videos[0].language, 'en')
  assert.equal(videos[0].thumbnail, 'https://img.example/video.jpg')
  assert.ok(result.resources.every((resource) => resource.url.startsWith('https://')))
})

test('search survives one provider failing when the other returns real resources', async (t) => {
  const videoId = 'dQw4w9WgXcQ'
  let tavilyAttempts = 0
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.tavily.com') { tavilyAttempts++; return new Response('{}', { status: 503 }) }
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/search')) return new Response(JSON.stringify({ items: [{ id: { videoId }, snippet: { title: 'React lesson' } }] }), { status: 200 })
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/videos')) return new Response(JSON.stringify({ items: [{ id: videoId, contentDetails: { duration: 'PT5M' }, snippet: { channelTitle: 'React Channel' } }] }), { status: 200 })
    if (url.hostname === 'generativelanguage.googleapis.com') return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }), { status: 200 })
    throw new Error(`Unexpected provider URL: ${url.hostname}${url.pathname}`)
  })
  const result = await searchLearning('React partial provider failure')
  assert.equal(tavilyAttempts, 2)
  assert.equal(result.resources.length, 1)
  assert.equal(result.resources[0].source, 'YouTube, React Channel')
})

test('search ranks topic matches ahead of high-scoring unrelated provider results', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.tavily.com') return new Response(JSON.stringify({ results: [
      { title: 'Cybersecurity beginners course', url: 'https://security.example/course', content: 'Security foundations.', score: 0.99 },
      { title: 'React guide for beginners', url: 'https://react.example/guide', content: 'Learn React components.', score: 0.2 },
    ] }), { status: 200 })
    if (url.hostname === 'www.googleapis.com') return new Response(JSON.stringify({ items: [] }), { status: 200 })
    if (url.hostname === 'generativelanguage.googleapis.com') return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }), { status: 200 })
    throw new Error(`Unexpected provider URL: ${url.hostname}${url.pathname}`)
  })
  const result = await searchLearning('React.js relevance ranking')
  assert.equal(result.resources.length, 1, 'clearly unrelated results should not be shown for this query')
  assert.equal(result.resources[0].title, 'React guide for beginners')
})

test('search keeps real results when optional Gemini ranking hits its bounded 429 fallback', async (t) => {
  let rankingAttempts = 0
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.tavily.com') return new Response(JSON.stringify({ results: [{ title: 'React documentation guide', url: 'https://react.example/docs', content: 'React documentation.', score: 0.8 }] }), { status: 200 })
    if (url.hostname === 'www.googleapis.com') return new Response(JSON.stringify({ items: [] }), { status: 200 })
    if (url.hostname === 'generativelanguage.googleapis.com') { rankingAttempts++; return new Response('{}', { status: 429 }) }
    throw new Error(`Unexpected provider URL: ${url.hostname}${url.pathname}`)
  })
  const result = await searchLearning('React optional ranking quota')
  assert.equal(result.resources.length, 1)
  assert.equal(result.resources[0].title, 'React documentation guide')
  assert.equal(rankingAttempts, 2, 'ranking should make one primary request and one fallback request')
})

test('search returns a clean unavailable error when all discovery providers fail', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.tavily.com') return new Response('{}', { status: 500 })
    if (url.hostname === 'www.googleapis.com') return new Response('{}', { status: 503 })
    throw new Error(`Unexpected provider URL: ${url.hostname}${url.pathname}`)
  })
  await assert.rejects(searchLearning('React all providers unavailable'), (error: Error & { statusCode?: number }) => error.statusCode === 503 && /temporarily unavailable/.test(error.message))
})

test('resource URLs normalize tracking parameters and YouTube URL variants', () => {
  assert.equal(learningInternals.normalizeResourceUrl('https://youtu.be/dQw4w9WgXcQ?t=20'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.equal(learningInternals.normalizeResourceUrl('https://react.dev/learn/?utm_source=test#intro'), 'https://react.dev/learn')
  assert.deepEqual(learningInternals.parseJsonPayload('Roadmap follows:\n```json\n{"title":"React"}\n```'), { title: 'React' })
  assert.throws(() => learningInternals.parseJsonPayload('```json\n{"title":\n```'), /incomplete JSON|invalid JSON/)
})

test('invalid roadmap structure is rejected with a clean error rather than persisted', async (t) => {
  const models: string[] = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input))
    models.push(decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]))
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Empty roadmap', topics: [] }) }] } }] }), { status: 200 })
  })
  await assert.rejects(generateRoadmap('React invalid schema', 'Beginner', []), (error: Error & { statusCode?: number }) => error.statusCode === 502 && /usable learning roadmap/.test(error.message))
  assert.equal(models.length, 2, 'invalid primary output should try the configured fallback once')
})
