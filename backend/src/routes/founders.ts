import { Router } from 'express'
import { z } from 'zod'
import { getFounderContacts, searchFundedFounders } from '../services/founders.js'

export const foundersRouter = Router()
const searchSchema = z.object({
  query: z.string().trim().max(200).optional().default(''),
  category: z.string().trim().regex(/^[a-z0-9-]+$/).max(60).optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

foundersRouter.get('/search', async (req, res, next) => {
  const parsed = searchSchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Search term, category, or result limit is invalid.' } }); return }
  try { res.json(await searchFundedFounders(parsed.data)) } catch (error) { next(error) }
})

foundersRouter.get('/:slug/contacts', async (req, res, next) => {
  const slug = z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9-]+$/).safeParse(req.params.slug)
  if (!slug.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Startup identifier is invalid.' } }); return }
  try { res.json({ contacts: await getFounderContacts(slug.data) }) } catch (error) { next(error) }
})
