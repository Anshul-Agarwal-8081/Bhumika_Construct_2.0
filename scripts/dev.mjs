import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['--import', 'tsx', 'backend/src/server.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 100)
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start the local app:', error.message)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    if (!stopping) stop(typeof code === 'number' ? code : signal ? 1 : 0)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
