import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execFileSync } from 'node:child_process'
import process from 'node:process'

function releaseVersion() {
  const configured = process.env.VITE_APP_VERSION || process.env.VITE_GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA
  if (configured) return configured
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
    return sha + (dirty ? '-dirty' : '')
  } catch { return '' }
}

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(releaseVersion()) },
  plugins: [react(), tailwindcss()],
})
