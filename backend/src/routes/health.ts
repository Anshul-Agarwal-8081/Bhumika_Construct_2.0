import { Router } from 'express'
import { env, hasSupabase } from '../config/env.js'

export const healthRouter = Router()
healthRouter.get('/', (_req, res) => res.json({
  status: 'ok',
  service: 'bhumika-api',
  environment: env.NODE_ENV,
  integrations: {
    supabase: hasSupabase ? 'configured' : 'not_configured',
    openai: env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    gemini: env.GEMINI_API_KEY ? 'configured' : 'not_configured',
    learningSearch: env.TAVILY_API_KEY || env.YOUTUBE_API_KEY ? 'configured' : 'not_configured',
    youtube: env.YOUTUBE_API_KEY ? 'configured' : 'not_configured',
    jobs: env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY ? 'configured' : 'not_configured',
    founderFinder: env.RECENT_FUNDING_API_KEY && env.RECENT_FUNDING_ON_BEHALF_OF ? 'configured' : 'not_configured',
  },
}))
