import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found.' } }) }

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = Number(error?.statusCode ?? error?.status) || 500
  if (status >= 500) console.error(`[api] request failed status=${status} type=${error instanceof Error ? error.name.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'Error' : 'UnknownError'}`)
  const message = status >= 500 ? 'An unexpected server error occurred.' : (error instanceof Error ? error.message : 'An unexpected request error occurred.')
  res.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message } })
}
