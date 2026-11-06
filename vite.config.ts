import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const backendEnv = loadEnv(mode, resolve(process.cwd(), 'backend'), '')
  const apiBase = process.env.VITE_API_BASE_URL || frontendEnv.VITE_API_BASE_URL || backendEnv.VITE_API_BASE_URL || `http://localhost:${backendEnv.PORT || '5000'}/api`
  return {
    plugins: [react(), tailwindcss()],
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBase) },
  }
})
