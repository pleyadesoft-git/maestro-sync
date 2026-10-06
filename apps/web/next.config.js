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
