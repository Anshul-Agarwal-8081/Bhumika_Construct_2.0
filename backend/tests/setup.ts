// Mock provider credentials keep unit tests independent from a developer's backend/.env.
// The tests replace fetch and never send these values to external services.
process.env.NODE_ENV ??= 'test'
process.env.SUPABASE_URL ??= 'https://supabase.test'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.GEMINI_API_KEY ??= 'test-gemini-key'
process.env.GEMINI_MODEL ??= 'test-gemini-model'
process.env.GEMINI_FALLBACK_MODEL ??= 'test-gemini-fallback-model'
process.env.TAVILY_API_KEY ??= 'test-tavily-key'
process.env.YOUTUBE_API_KEY ??= 'test-youtube-key'
