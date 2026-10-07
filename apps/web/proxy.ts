import createMiddleware from 'next-intl/middleware'

const intlMiddleware = createMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'es',
})

export function proxy(request: any) {
  return intlMiddleware(request)
}

export default proxy

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
