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
