import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../config/supabase.js'
import { createSupabaseAdminClient } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { env } from '../config/env.js'

export const authRouter = Router()
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) })
export const refreshTokenSchema = z.string().min(12).max(2048).refine(
  (token) => token.length !== 12 || /^[a-z0-9]{12}$/.test(token),
)

function sanitizedSupabaseAuthMessage(error: { message?: string; name?: string }): string {
  const message = error.message ?? ''
  if (/invalid login credentials|invalid_credentials/i.test(message)) return 'Invalid login credentials'
  if (/email not confirmed|email_not_confirmed/i.test(message)) return 'Email not confirmed'
  if (/invalid api key|invalid_api_key/i.test(message)) return 'Invalid API key'
  if (/invalid refresh token|refresh token.*(not found|expired)|invalid_grant/i.test(message)) return 'Refresh token is invalid or expired'
  if (/user not found|user_not_found/i.test(message)) return 'User not found'
  if (/too many requests|rate limit/i.test(message)) return 'Authentication rate limit exceeded'
  return `Supabase authentication error (${(error.name ?? 'AuthError').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'AuthError'})`
}

authRouter.post('/register', async (req, res, next) => {
  const input = credentials.safeParse(req.body)
  if (!input.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide a valid email and a password with at least 8 characters.' } }); return }
  try {
    const { data, error } = await createSupabaseClient().auth.signUp(input.data)
    if (error) {
      if (env.NODE_ENV !== 'production') console.warn(`[auth.register] status=400 provider="Supabase" message="${sanitizedSupabaseAuthMessage(error)}"`)
      res.status(400).json({ error: { code: 'REGISTRATION_FAILED', message: 'Could not create this account. Check the details or try signing in.' } }); return
    }
    res.status(201).json({ user: data.user, session: data.session, confirmationRequired: !data.session })
  } catch (error) { next(error) }
})

authRouter.post('/login', async (req, res, next) => {
  const input = credentials.safeParse(req.body)
  if (!input.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide a valid email and password.' } }); return }
  try {
    const { data, error } = await createSupabaseClient().auth.signInWithPassword(input.data)
    if (error || !data.session) {
      if (env.NODE_ENV !== 'production') console.warn(`[auth.login] status=401 provider="Supabase" message="${sanitizedSupabaseAuthMessage(error ?? { message: 'No session returned' })}"`)
      res.status(401).json({ error: { code: 'LOGIN_FAILED', message: 'Email or password was not accepted.' } }); return
    }
    res.json({ user: data.user, session: data.session })
  } catch (error) { next(error) }
})

authRouter.post('/refresh', async (req, res, next) => {
  const input = z.object({ refresh_token: refreshTokenSchema }).strict().safeParse(req.body)
  if (!input.success) {
    if (env.NODE_ENV !== 'production') console.warn('[auth.refresh] status=400 provider="Bhumika" reason="invalid refresh-token payload"')
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A valid refresh token is required.' } }); return
  }
  try {
    const { data, error } = await createSupabaseClient().auth.refreshSession({ refresh_token: input.data.refresh_token })
    if (error || !data.session) {
      if (env.NODE_ENV !== 'production') console.warn(`[auth.refresh] status=401 provider="Supabase" message="${sanitizedSupabaseAuthMessage(error ?? { message: 'No session returned' })}"`)
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' } }); return
    }
    res.json({ user: data.user, session: data.session })
  } catch (error) { next(error) }
})

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }))

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try { const { error } = await createSupabaseAdminClient().auth.admin.signOut(req.accessToken!, 'local'); if (error) throw error; res.status(204).end() } catch (error) { next(error) }
})

authRouter.post('/forgot-password', async (req, res, next) => {
  const input = z.object({ email: z.string().email().max(254) }).safeParse(req.body)
  if (!input.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide a valid email address.' } }); return }
  try {
    const { error } = await createSupabaseClient().auth.resetPasswordForEmail(input.data.email)
    if (error) throw error
    res.json({ message: 'If the account exists, password reset instructions have been requested.' })
  } catch (error) { next(error) }
})

authRouter.post('/update-password', requireAuth, async (req, res, next) => {
  const input = z.object({ password: z.string().min(8).max(128) }).strict().safeParse(req.body)
  if (!input.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide a new password with at least 8 characters.' } }); return }
  try {
    const { data, error } = await createSupabaseAdminClient().auth.admin.updateUserById(req.user!.id, { password: input.data.password })
    if (error) throw error
    res.json({ user: { id: data.user.id } })
  } catch (error) { next(error) }
})
