import { createHash } from 'node:crypto'
import { z } from 'zod'
import { env } from '../config/env.js'
import { generateWithGemini } from '../config/gemini.js'

function normalizeResourceUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Resource URL must use HTTP or HTTPS.')
  url.hash = ''
  if (url.hostname === 'youtu.be' || /(^|\.)youtube\.com$/i.test(url.hostname)) {
    const videoId = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? (url.hostname === 'youtu.be' ? url.pathname.split('/')[1] : undefined)
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return `https://www.youtube.com/watch?v=${videoId}`
  }
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString()
}

export const resourceSchema = z.object({
  id: z.string().min(1), title: z.string().trim().min(1).max(500), description: z.string().max(6000),
  url: z.string().url().transform(normalizeResourceUrl), source: z.string().trim().min(1).max(300),
  type: z.enum(['Video', 'Course', 'Article', 'Documentation', 'Practice']),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']), estimatedTime: z.string().nullable(),
  language: z.string().nullable(), freeAccess: z.enum(['fully_free', 'partially_free', 'free_trial', 'paid', 'unknown']), reason: z.string().max(500),
  thumbnail: z.string().url().nullable().optional(), publishedAt: z.string().nullable().optional(),
})
export type LearningResource = z.infer<typeof resourceSchema>

const cache = new Map<string, { expires: number; resources: LearningResource[] }>()
const id = (url: string) => createHash('sha1').update(normalizeResourceUrl(url)).digest('hex').slice(0, 16)
const temporaryStatus = (status: number) => status === 429 || [500, 502, 503, 504].includes(status)

async function provider<T>(url: string, init: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) })
      const body = await response.json().catch(() => ({}))
      if (response.ok) return body as T
      if (!temporaryStatus(response.status) || attempt === 1) {
        throw Object.assign(new Error('A learning search provider returned an error.'), { statusCode: response.status === 429 ? 503 : 502 })
      }
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode)
      const retryable = !status || status === 503
      if (!retryable || attempt === 1) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
  }
  throw Object.assign(new Error('A learning search provider is temporarily unavailable.'), { statusCode: 503 })
}

type RankedResource = { resource: LearningResource; relevance: number }

function parseDurationMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const range = value.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)/i)
  const amounts: number[] = []
  if (range) {
    const factor = /week/i.test(range[3]) ? 5 * 8 * 60 : /day/i.test(range[3]) ? 8 * 60 : /hour|hr/i.test(range[3]) ? 60 : 1
    amounts.push((Number(range[1]) + Number(range[2])) / 2 * factor)
  } else {
    for (const match of value.matchAll(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)/gi)) {
      const unit = match[2]
      const factor = /week/i.test(unit) ? 5 * 8 * 60 : /day/i.test(unit) ? 8 * 60 : /hour|hr/i.test(unit) ? 60 : 1
      amounts.push(Number(match[1]) * factor)
    }
  }
  return amounts.length ? amounts.reduce((sum, item) => sum + item, 0) : null
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = Math.round(minutes % 60)
  if (!hours) return `${Math.max(1, remainder)} minutes`
  if (!remainder) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainder} minutes`
}

async function searchTavily(query: string): Promise<RankedResource[]> {
  const body = await provider<{ results?: unknown }>('https://api.tavily.com/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: `${query} learn tutorial documentation course`, search_depth: 'basic', max_results: 8 }),
  })
  const results = Array.isArray(body.results) ? body.results as { title?: unknown; url?: unknown; content?: unknown; score?: unknown; published_date?: unknown }[] : []
  return results.flatMap((item) => {
    if (typeof item.title !== 'string' || !item.title.trim() || typeof item.url !== 'string') return []
    let url: string
    try { url = normalizeResourceUrl(item.url) } catch { return [] }
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const isYouTubeVideo = host === 'youtube.com' && /^[A-Za-z0-9_-]{11}$/.test(new URL(url).searchParams.get('v') ?? '')
    const official = /(^|\.)(react\.dev|developer\.mozilla\.org|python\.org)$/.test(host)
    const resource = resourceSchema.parse({
      id: id(url), title: item.title, description: typeof item.content === 'string' ? item.content.slice(0, 6000) : '', url, source: isYouTubeVideo ? 'YouTube' : host,
      type: isYouTubeVideo ? 'Video' : /docs|documentation/i.test(item.title) || official ? 'Documentation' : 'Article', level: 'Beginner',
      estimatedTime: null, language: null, freeAccess: 'unknown', reason: '', publishedAt: typeof item.published_date === 'string' ? item.published_date : null,
    })
    const score = typeof item.score === 'number' && Number.isFinite(item.score) ? Math.min(1, Math.max(0, item.score)) : 0.45
    return [{ resource, relevance: score }]
  })
}

function isoDurationLabel(value?: string) {
  if (!value) return null
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) + (Number(match[3] ?? 0) >= 30 ? 1 : 0)
  return formatDuration(minutes)
}

async function searchYouTube(query: string): Promise<RankedResource[]> {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  for (const [key, value] of Object.entries({ part: 'snippet', type: 'video', maxResults: '8', q: `${query} beginner tutorial`, key: env.YOUTUBE_API_KEY! })) searchUrl.searchParams.set(key, value)
  const body = await provider<{ items?: unknown }>(searchUrl.toString(), {})
  const items = Array.isArray(body.items) ? body.items as { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } } }[] : []
  const candidates = items.flatMap((item) => {
    const videoId = item.id?.videoId
    const snippet = item.snippet
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || !snippet?.title?.trim()) return []
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const thumbnail = snippet.thumbnails?.medium?.url
    const resource = resourceSchema.parse({
      id: id(url), title: snippet.title, description: snippet.description ?? '', url,
      source: snippet.channelTitle?.trim() || 'YouTube', type: 'Video', level: 'Beginner', estimatedTime: null,
      language: null, freeAccess: 'unknown', reason: '', thumbnail: thumbnail && /^https?:\/\//i.test(thumbnail) ? thumbnail : null,
      publishedAt: snippet.publishedAt ?? null,
    })
    return [{ resource, relevance: 0.4 }]
  })
  if (!candidates.length) return []

  return candidates
}

async function enrichYouTubeVideos(resources: LearningResource[]): Promise<LearningResource[]> {
  const videos = resources.filter((resource) => resource.type === 'Video').slice(0, 8)
  if (!env.YOUTUBE_API_KEY || !videos.length) return resources
  const videoIds = videos.map((resource) => new URL(resource.url).searchParams.get('v')).filter((value): value is string => Boolean(value && /^[A-Za-z0-9_-]{11}$/.test(value)))
  if (!videoIds.length) return resources
  try {
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    for (const [key, value] of Object.entries({ part: 'contentDetails,snippet', id: videoIds.join(','), key: env.YOUTUBE_API_KEY })) detailsUrl.searchParams.set(key, value)
    const details = await provider<{ items?: { id?: string; contentDetails?: { duration?: string }; snippet?: { channelTitle?: string; defaultLanguage?: string; defaultAudioLanguage?: string; thumbnails?: { medium?: { url?: string } } } }[] }>(detailsUrl.toString(), {})
    const byId = new Map((details.items ?? []).map((item) => [item.id, item]))
    return resources.flatMap((resource) => {
      if (resource.type !== 'Video') return [resource]
      const videoId = new URL(resource.url).searchParams.get('v') ?? ''
      const detail = byId.get(videoId)
      if (!detail) return []
      const sourceNames = [...new Set([resource.source, detail.snippet?.channelTitle].filter((value): value is string => Boolean(value?.trim())).flatMap((value) => value.split(',').map((part) => part.trim())))]
      return [{
        ...resource,
        source: sourceNames.join(', '),
        estimatedTime: isoDurationLabel(detail.contentDetails?.duration) ?? resource.estimatedTime,
        language: detail.snippet?.defaultAudioLanguage ?? detail.snippet?.defaultLanguage ?? resource.language,
        thumbnail: detail.snippet?.thumbnails?.medium?.url ?? resource.thumbnail,
      }]
    })
  } catch { return resources }
}

async function discover(query: string): Promise<LearningResource[]> {
  const tasks: Promise<RankedResource[]>[] = []
  if (env.TAVILY_API_KEY) tasks.push(searchTavily(query))
  if (env.YOUTUBE_API_KEY) tasks.push(searchYouTube(query))
  if (!tasks.length) throw Object.assign(new Error('Learning search is not configured. Add TAVILY_API_KEY or YOUTUBE_API_KEY.'), { statusCode: 503 })
  const settled = await Promise.allSettled(tasks)
  const results = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : [])
  if (!results.length) throw Object.assign(new Error('Learning providers are temporarily unavailable. Please try again shortly.'), { statusCode: 503 })

  const merged = new Map<string, RankedResource>()
  for (const item of results) {
    const key = normalizeResourceUrl(item.resource.url)
    const existing = merged.get(key)
    if (!existing) merged.set(key, item)
    else {
      const sourceNames = [...new Set(`${existing.resource.source},${item.resource.source}`.split(',').map((source) => source.trim()).filter(Boolean))]
      const preferred = item.resource.type === 'Video' ? item : existing
      merged.set(key, { relevance: Math.max(existing.relevance, item.relevance), resource: { ...preferred.resource, source: sourceNames.join(', ') } })
    }
  }
  const resources = [...merged.values()].filter((item) => topicRelevance(item.resource, query) > 0).sort((a, b) => topicRelevance(b.resource, query) - topicRelevance(a.resource, query) || b.relevance - a.relevance).map((item) => item.resource)
  return enrichYouTubeVideos(resources)
}

function parseJsonPayload(value: string): unknown {
  const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(text) } catch { /* Search for a JSON value wrapped in prose. */ }
  const start = text.search(/[\[{]/)
  if (start < 0) throw new Error('Gemini returned invalid JSON.')
  const stack: string[] = []
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') { quoted = true; continue }
    if (character === '{' || character === '[') stack.push(character)
    if (character === '}' || character === ']') {
      const opening = stack.pop()
      if ((character === '}' && opening !== '{') || (character === ']' && opening !== '[')) throw new Error('Gemini returned invalid JSON.')
      if (!stack.length) return JSON.parse(text.slice(start, index + 1))
    }
  }
  throw new Error('Gemini returned incomplete JSON.')
}

function topicRelevance(resource: LearningResource, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const stopWords = new Set(['a', 'an', 'and', 'for', 'from', 'how', 'in', 'learn', 'of', 'on', 'the', 'to', 'with'])
  const normalizedQuery = normalize(query)
  const terms = [...new Set(
    normalizedQuery.split(/\s+/).filter((term) => (term.length > 1 || normalizedQuery.length === 1) && !stopWords.has(term)),
  )]
  if (!terms.length) return 0
  const title = normalize(resource.title)
  const description = normalize(resource.description)
  const phrase = normalize(query)
  return (phrase.length > 1 && title.includes(phrase) ? 3 : 0) + terms.reduce((score, term) => score + (title.includes(term) ? 2 : 0) + (description.includes(term) ? 0.25 : 0), 0)
}

export async function searchLearning(query: string) {
  const key = query.trim().toLowerCase()
  const saved = cache.get(key)
  const resources = saved && saved.expires > Date.now() ? saved.resources : await discover(query)
  if (!saved || saved.expires <= Date.now()) cache.set(key, { resources, expires: Date.now() + env.CACHE_TTL_SECONDS * 1000 })
  const originalOrder = new Map(resources.map((resource, index) => [resource.id, index]))
  const compareByTopic = (a: LearningResource, b: LearningResource) => topicRelevance(b, query) - topicRelevance(a, query) || (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0)
  let ranked = [...resources].sort(compareByTopic)
  if (env.GEMINI_API_KEY && env.GEMINI_MODEL && resources.length) {
    const input = resources.map(({ id, title, description, source, type }) => ({ id, title, description: description.slice(0, 500), source, type }))
    try {
      const rankingSchema = z.array(z.object({ id: z.string(), level: z.enum(['Beginner', 'Intermediate', 'Advanced']), reason: z.string().max(300) }))
      const rankingResponseSchema = {
        type: 'ARRAY', items: { type: 'OBJECT', properties: {
          id: { type: 'STRING' }, level: { type: 'STRING', enum: ['Beginner', 'Intermediate', 'Advanced'] }, reason: { type: 'STRING' },
        }, required: ['id', 'level', 'reason'] },
      }
      const output = await generateWithGemini(`Rank these real resources for the learning topic ${JSON.stringify(query)}. Return one JSON array sorted best-first, with objects {"id": string, "level": "Beginner"|"Intermediate"|"Advanced", "reason": string}. Use only supplied IDs and no invented facts. Resources: ${JSON.stringify(input)}`, (text) => rankingSchema.parse(parseJsonPayload(text)), rankingResponseSchema, { maxAttempts: 1 })
      const order = new Map(output.value.map((item, index) => [item.id, index]))
      const byId = new Map(output.value.map((item) => [item.id, item]))
      ranked = resources.map((resource) => ({ ...resource, ...(byId.get(resource.id) ?? {}) })).sort((a, b) => topicRelevance(b, query) - topicRelevance(a, query) || (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0))
    } catch { /* Keep provider-ranked results if Gemini is unavailable. */ }
  }
  return { query, resources: ranked }
}

const roadmapSchema = z.object({
  title: z.string().trim().min(3).max(160),
  topics: z.array(z.object({
    title: z.string().trim().min(2).max(160), explanation: z.string().trim().min(15).max(2000),
    objective: z.string().trim().min(8).max(500), difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    estimatedTime: z.string().trim().min(2).max(80), prerequisites: z.array(z.string().trim().min(1).max(160)).max(10),
    resourceIds: z.array(z.string().min(1)).max(12), practiceSuggestions: z.array(z.string().trim().min(8).max(500)).min(1).max(8),
    miniProject: z.string().trim().min(8).max(500),
  })).min(5).max(7),
})

const roadmapResponseSchema: Record<string, unknown> = {
  type: 'OBJECT', properties: {
    title: { type: 'STRING' },
    topics: { type: 'ARRAY', minItems: 5, maxItems: 7, items: { type: 'OBJECT', properties: {
      title: { type: 'STRING' }, explanation: { type: 'STRING' }, objective: { type: 'STRING' },
      difficulty: { type: 'STRING', enum: ['Beginner', 'Intermediate', 'Advanced'] }, estimatedTime: { type: 'STRING' },
      prerequisites: { type: 'ARRAY', items: { type: 'STRING' } }, resourceIds: { type: 'ARRAY', items: { type: 'STRING' } },
      practiceSuggestions: { type: 'ARRAY', minItems: 1, items: { type: 'STRING' } }, miniProject: { type: 'STRING' },
    }, required: ['title', 'explanation', 'objective', 'difficulty', 'estimatedTime', 'prerequisites', 'resourceIds', 'practiceSuggestions', 'miniProject'] } },
  }, required: ['title', 'topics'],
}

export async function generateRoadmap(query: string, level: 'Beginner' | 'Intermediate' | 'Advanced', resources: LearningResource[]) {
  const prompt = `Create a progressive 5 to 7 stage learning roadmap for ${JSON.stringify(query)} at ${level} level. Every stage must have a concrete description, a measurable learning objective, a realistic time estimate, ordered prerequisites, one or more practical exercises, and a mini-project. Return only JSON matching {"title":string,"topics":[{"title":string,"explanation":string,"objective":string,"difficulty":"Beginner"|"Intermediate"|"Advanced","estimatedTime":string,"prerequisites":string[],"resourceIds":string[],"practiceSuggestions":string[],"miniProject":string}]}. Select resourceIds only from this list, and use an empty array if none fit: ${JSON.stringify(resources.map((resource) => ({ id: resource.id, title: resource.title, source: resource.source, url: resource.url })))}`

  let data: z.infer<typeof roadmapSchema>
  try {
    const generated = await generateWithGemini(prompt, (text) => {
      const parsed = roadmapSchema.parse(parseJsonPayload(text))
      if (parsed.topics.some((topic) => !parseDurationMinutes(topic.estimatedTime))) throw new Error('Stage time estimate must be a readable duration.')
      return parsed
    }, roadmapResponseSchema)
    data = generated.value
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/temporarily unavailable|not configured|valid roadmap/i.test(message)) throw Object.assign(new Error('We could not generate a valid roadmap right now. Please try again shortly.'), { statusCode: 503 })
    throw Object.assign(new Error('We could not create a usable learning roadmap. Please try again with a more specific topic.'), { statusCode: 502 })
  }

  const totalMinutes = data.topics.reduce((sum, topic) => {
    const minutes = parseDurationMinutes(topic.estimatedTime)
    return sum + (minutes ?? 0)
  }, 0)
  return {
    title: data.title,
    difficulty: level,
    estimatedTotalDuration: formatDuration(totalMinutes),
    topics: data.topics.map((topic, index) => ({
      ...topic,
      id: createHash('sha1').update(`${query}:${index}:${topic.title}`).digest('hex').slice(0, 16),
      resourceIds: [...new Set(topic.resourceIds.filter((resourceId) => resources.some((resource) => resource.id === resourceId)))],
      completed: false,
    })),
  }
}

export const learningInternals = { normalizeResourceUrl, parseDurationMinutes, parseJsonPayload }
