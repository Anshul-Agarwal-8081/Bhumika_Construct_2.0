import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import { profileRouter } from './routes/profile.js'
import { learningRouter } from './routes/learning.js'
import { foundersRouter } from './routes/founders.js'
import { errorHandler, notFound } from './middleware/error.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: [env.FRONTEND_ORIGIN, 'http://127.0.0.1:5173', 'http://localhost:5173'], credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
app.use(express.json({ limit: '256kb' }))
app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX_REQUESTS, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/learning', learningRouter)
app.use('/api/founders', foundersRouter)
app.use(notFound)
app.use(errorHandler)
