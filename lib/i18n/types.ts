/**
 * BCP-47 tags for locales the app currently ships UI catalogues for.
 * Add to this list AND to `lib/i18n/messages.ts` when introducing a new
 * language; the locale resolvers and every consumer then pick it up
 * automatically.
 */
export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

/**
 * Name of the cookie that carries an explicit locale override. Set by the
 * `setLocale` server action (e.g. from a language picker) and read FIRST by
 * both the public and authed locale resolvers — it is the single source of a
 * user-chosen language, taking precedence over `persons.locale` and the
 * `DEFAULT_LOCALE` fallback.
 */
export const LOCALE_COOKIE = 'app.locale'

/**
 * Name of the cookie that carries the browser's IANA timezone. Written by
 * `<TimezoneSync>` (client, root layout) and read by `getCurrentTimezone`
 * (server). See `lib/i18n/getTimezone.ts` for why this is a cookie and not
 * a DB column.
 */
export const TZ_COOKIE = 'app.tz'

/**
 * The ultimate fallback locale. The template is English-first — every
 * surface (public AND authed) falls back to this when nothing more specific
 * (locale cookie, persons.locale) resolves.
 */
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}
