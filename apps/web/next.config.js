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

const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' && process.env.ENABLE_PWA !== 'true',
  register: true,
  workboxOptions: {
    skipWaiting: false,
    clientsClaim: true,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@music-flow/ui',
    '@music-flow/stores',
    '@music-flow/supabase',
    '@music-flow/i18n',
    '@music-flow/stripe',
  ],
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
  turbopack: {},
}

module.exports = withPWA(withNextIntl(nextConfig))
