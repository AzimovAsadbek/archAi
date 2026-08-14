export const LOCALES = ['uz', 'ru', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'uz';

/** Cookie that carries the chosen UI language (readable by the client on purpose). */
export const LOCALE_COOKIE = 'archai_locale';

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}
