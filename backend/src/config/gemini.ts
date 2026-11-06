import { env } from './env.js'

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { status?: string; message?: string } }
const temporary = (status: number) => status === 429 || [500, 502, 503, 504].includes(status)

class ProviderFailure extends Error {
  constructor(readonly status: number, message: string, readonly retryable = true) { super(message) }
}

class InvalidModelOutput extends Error {}

type GeminiResponseSchema = Record<string, unknown>
type GeminiGenerationOptions = { maxAttempts?: 1 | 2 | 3 }

async function generate<T>(model: string, prompt: string, validate?: (text: string) => T, responseSchema?: GeminiResponseSchema, maxAttempts = 3): Promise<{ text: string; value?: T }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(validate ? { generationConfig: { responseMimeType: 'application/json', ...(responseSchema ? { responseSchema } : {}) } } : {}) }),
      })
      const body = await response.json().catch(() => ({})) as GeminiResponse
      if (!response.ok) {
        const quotaExhausted = response.status === 429 && (/quota_exceeded|resource_exhausted/i.test(body.error?.status ?? '') || /quota.{0,30}(exceed|limit)|(?:exceed|limit).{0,30}quota/i.test(body.error?.message ?? ''))
        const failure = new ProviderFailure(response.status, `Gemini request failed (${response.status}).`, !quotaExhausted)
        if (!temporary(response.status) || !failure.retryable || attempt === maxAttempts - 1) throw failure
      } else {
        const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
        if (!text) throw new InvalidModelOutput('Gemini returned an empty response.')
        if (validate) {
          try { return { text, value: validate(text) } }
          catch { throw new InvalidModelOutput('Gemini returned an invalid structured response.') }
        }
        return { text }
      }
    } catch (error) {
      if (error instanceof ProviderFailure || error instanceof InvalidModelOutput) throw error
      const transient = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message === 'fetch failed')
      if (!transient || attempt === maxAttempts - 1) throw new ProviderFailure(503, 'Gemini request timed out or could not connect.')
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt) + Math.floor(Math.random() * 150)))
  }
  throw new ProviderFailure(503, 'Gemini is temporarily unavailable.')
}

export function generateWithGemini(prompt: string): Promise<{ model: string; text: string }>
export function generateWithGemini<T>(prompt: string, validate: (text: string) => T, responseSchema?: GeminiResponseSchema, options?: GeminiGenerationOptions): Promise<{ model: string; text: string; value: T }>
export async function generateWithGemini<T>(prompt: string, validate?: (text: string) => T, responseSchema?: GeminiResponseSchema, options: GeminiGenerationOptions = {}) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw Object.assign(new Error('Gemini is not configured.'), { statusCode: 503 })
  const invoke = async (model: string) => {
    const result = await generate(model, prompt, validate, responseSchema, options.maxAttempts ?? 3)
    return { model, text: result.text, ...(validate ? { value: result.value as T } : {}) }
  }
  try { return await invoke(env.GEMINI_MODEL) }
  catch (primary) {
    const mayFallback = primary instanceof InvalidModelOutput || (!(primary instanceof ProviderFailure) || primary.status === 404 || (primary.retryable && temporary(primary.status)))
    if (!mayFallback || !env.GEMINI_FALLBACK_MODEL || env.GEMINI_FALLBACK_MODEL === env.GEMINI_MODEL) {
      if (primary instanceof InvalidModelOutput) throw Object.assign(new Error('Gemini could not return a valid structured response.'), { statusCode: 502 })
      if (primary instanceof ProviderFailure && primary.status === 429 && !primary.retryable) throw Object.assign(new Error('Gemini quota is temporarily unavailable.'), { statusCode: 503 })
      throw primary
    }
    try { return await invoke(env.GEMINI_FALLBACK_MODEL) }
    catch (fallback) {
      if (fallback instanceof InvalidModelOutput) throw Object.assign(new Error('Gemini could not return a valid structured response.'), { statusCode: 502 })
      throw Object.assign(new Error('Gemini is temporarily unavailable. Please try again shortly.'), { statusCode: 503 })
    }
  }
}
