import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT)
server.on('listening', () => console.info(`Bhūmikā API listening on port ${env.PORT} (${env.NODE_ENV})`))
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Bhūmikā API could not listen on port ${env.PORT}: ${error.code ?? error.message}`)
  process.exitCode = 1
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
