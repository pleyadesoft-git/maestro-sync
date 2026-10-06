import { getRequestConfig } from 'next-intl/server'
import { messages } from '@music-flow/i18n'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || (locale !== 'es' && locale !== 'en')) {
    locale = 'es'
  }

  return {
    locale,
    messages: messages[locale as 'es' | 'en'] || messages.es,
  }
})
