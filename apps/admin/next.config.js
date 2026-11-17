const fs = require('fs')
const path = require('path')

// Carga automática del archivo .env de la raíz del monorepo si existe
function loadRootEnv() {
  const rootEnvPath = path.resolve(__dirname, '../../.env')
  if (!fs.existsSync(rootEnvPath)) return
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(rootEnvPath)
      return
    } catch {
      // Ignorar error y usar fallback manual si falla
    }
  }
  try {
    const content = fs.readFileSync(rootEnvPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  } catch {
    // Ignorar si no se puede leer
  }
}
loadRootEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@music-flow/ui',
    '@music-flow/stores',
    '@music-flow/supabase',
    '@music-flow/stripe',
  ],
  turbopack: {},
}

module.exports = nextConfig
