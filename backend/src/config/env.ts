import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const backendEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
dotenv.config({ path: backendEnvPath })

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:5001'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  OPENAI_API_KEY: z.string().optional().or(z.literal('')),
  OPENAI_TEXT_MODEL: z.string().optional().or(z.literal('')),
  OPENAI_REALTIME_MODEL: z.string().optional().or(z.literal('')),
  GEMINI_API_KEY: z.string().optional().or(z.literal('')),
  GEMINI_MODEL: z.string().optional().or(z.literal('')),
  GEMINI_FALLBACK_MODEL: z.string().optional().or(z.literal('')),
  TAVILY_API_KEY: z.string().optional().or(z.literal('')),
  YOUTUBE_API_KEY: z.string().optional().or(z.literal('')),
  RECENT_FUNDING_API_KEY: z.string().optional().or(z.literal('')),
  RECENT_FUNDING_ON_BEHALF_OF: z.string().trim().max(160).optional().or(z.literal('')),
  ADZUNA_APP_ID: z.string().optional().or(z.literal('')),
  ADZUNA_APP_KEY: z.string().optional().or(z.literal('')),
  ONET_API_USERNAME: z.string().optional().or(z.literal('')),
  ONET_API_PASSWORD: z.string().optional().or(z.literal('')),
  ESCO_API_BASE_URL: z.string().optional().or(z.literal('')),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RESEND_API_KEY: z.string().optional().or(z.literal('')),
  EMAIL_FROM: z.string().optional().or(z.literal('')),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Backend configuration is invalid:', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  process.exit(1)
}

export const env = parsed.data
export const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)

