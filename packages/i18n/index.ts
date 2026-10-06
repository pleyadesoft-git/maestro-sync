import es from './messages/es.json'
import en from './messages/en.json'

export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

export const messages = {
  es,
  en,
} as const
