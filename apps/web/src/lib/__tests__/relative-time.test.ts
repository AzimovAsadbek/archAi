import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { relativeTimeParts } from '../relative-time';
import uz from '../../../messages/uz.json';
import ru from '../../../messages/ru.json';
import en from '../../../messages/en.json';

const NOW = 1_700_000_000_000;
const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const D = 24 * H;
const ago = (ms: number) => relativeTimeParts(NOW - ms, NOW);

describe('relativeTimeParts', () => {
  it('collapses sub-minute deltas and future clock skew to "now"', () => {
    expect(ago(0)).toEqual({ key: 'now' });
    expect(ago(30 * S)).toEqual({ key: 'now' });
    // A server timestamp a few seconds ahead of the client used to render "+17 s".
    expect(relativeTimeParts(NOW + 17 * S, NOW)).toEqual({ key: 'now' });
  });

  it('buckets into the largest whole unit', () => {
    expect(ago(5 * MIN)).toEqual({ key: 'minutesAgo', count: 5 });
    expect(ago(3 * H)).toEqual({ key: 'hoursAgo', count: 3 });
    expect(ago(15 * H)).toEqual({ key: 'hoursAgo', count: 15 }); // the audit's raw "-15 h" case
    expect(ago(3 * D)).toEqual({ key: 'daysAgo', count: 3 });
    expect(ago(60 * D)).toEqual({ key: 'monthsAgo', count: 2 });
    expect(ago(2 * 365 * D)).toEqual({ key: 'yearsAgo', count: 2 });
  });

  it('accepts Date, epoch-ms and ISO-string inputs equivalently', () => {
    expect(relativeTimeParts(new Date(NOW - 3 * H), new Date(NOW))).toEqual({ key: 'hoursAgo', count: 3 });
    expect(relativeTimeParts(new Date(NOW - 3 * H).toISOString(), NOW)).toEqual({ key: 'hoursAgo', count: 3 });
  });
});

describe('time catalog renders localized words (works around the uz ICU gap)', () => {
  type TimeFn = (key: string, values?: { count: number }) => string;
  const translator = (messages: typeof en, locale: string): TimeFn =>
    createTranslator({ locale, messages, namespace: 'time' }) as unknown as TimeFn;

  it('uz emits words, never the raw Intl.RelativeTimeFormat "-15 h"', () => {
    const t = translator(uz, 'uz');
    expect(t('now')).toBe('hozir');
    expect(t('minutesAgo', { count: 5 })).toBe('5 daqiqa oldin');
    expect(t('hoursAgo', { count: 15 })).toBe('15 soat oldin');
    expect(t('hoursAgo', { count: 15 })).not.toContain('-');
  });

  it('ru selects the correct one/few/many plural form', () => {
    const t = translator(ru, 'ru');
    expect(t('hoursAgo', { count: 1 })).toBe('1 час назад');
    expect(t('hoursAgo', { count: 2 })).toBe('2 часа назад');
    expect(t('hoursAgo', { count: 5 })).toBe('5 часов назад');
    expect(t('daysAgo', { count: 3 })).toBe('3 дня назад');
    expect(t('minutesAgo', { count: 5 })).toBe('5 минут назад');
  });

  it('en selects one/other', () => {
    const t = translator(en, 'en');
    expect(t('hoursAgo', { count: 1 })).toBe('1 hour ago');
    expect(t('hoursAgo', { count: 2 })).toBe('2 hours ago');
    expect(t('now')).toBe('just now');
  });
});
