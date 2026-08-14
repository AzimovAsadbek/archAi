/**
 * Turns a title into a lowercase kebab slug the API will accept — the server
 * enforces `^[a-z0-9]+(?:-[a-z0-9]+)*$`, so this is only a helpful suggestion the
 * admin can still override. Uzbek Latin letters (`oʻ`, `gʻ`, apostrophes) are
 * folded to ASCII; anything else non-alphanumeric collapses to a single dash.
 */
const TRANSLITERATE: Record<string, string> = {
  ʻ: '',
  ʼ: '',
  '‘': '',
  '’': '',
  "'": '',
  '`': '',
};

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ʻʼ‘’'`]/g, (char) => TRANSLITERATE[char] ?? '')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
    .replace(/-+$/g, '');
}
