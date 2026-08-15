import { describe, expect, it } from 'vitest';
import { SOTIX_IN_M2 } from '@archai/shared';
import {
  coveragePercent,
  footprintM2,
  formatUZS,
  initials,
  m2ToSotix,
  numberToInput,
  parseNumberInput,
  round,
  sotixToM2,
} from '../format';

const NBSP = 0x00a0;
const stripSpaces = (value: string) => [...value].filter((ch) => !/\s/.test(ch)).join('');
const hasNbsp = (value: string) => [...value].some((ch) => ch.charCodeAt(0) === NBSP);
const hasAsciiSpace = (value: string) => [...value].some((ch) => ch === ' ');

describe('round', () => {
  it('rounds to the requested precision and drops trailing zeros', () => {
    expect(round(1.24, 1)).toBe(1.2);
    expect(round(1.26, 1)).toBe(1.3);
    expect(round(5, 1)).toBe(5);
    expect(round(1.2345, 2)).toBe(1.23);
  });
});

describe('area conversions', () => {
  it('converts m² to sotix and back', () => {
    expect(m2ToSotix(SOTIX_IN_M2)).toBe(1);
    expect(m2ToSotix(SOTIX_IN_M2 * 3)).toBe(3);
    // Round-trips on whole values regardless of the constant.
    expect(m2ToSotix(sotixToM2(5))).toBe(5);
  });

  it('computes footprint and coverage', () => {
    expect(footprintM2(3, 4)).toBe(12);
    expect(coveragePercent(12, 100)).toBe(12);
    expect(coveragePercent(50, 200)).toBe(25);
    expect(coveragePercent(5, 0)).toBe(0); // guards divide-by-zero
  });
});

describe('formatUZS', () => {
  it('groups thousands and never uses a comma', () => {
    expect(stripSpaces(formatUZS(1000))).toBe('1000');
    expect(stripSpaces(formatUZS(1234567))).toBe('1234567');
    expect(formatUZS(999)).toBe('999');
    expect(formatUZS(1000)).not.toContain(',');
  });

  it('separates groups with a non-breaking space (U+00A0), not an ASCII space', () => {
    expect(hasNbsp(formatUZS(1000))).toBe(true);
    expect(hasAsciiSpace(formatUZS(1000))).toBe(false);
  });

  it('rounds to whole so’m', () => {
    expect(stripSpaces(formatUZS(1000.6))).toBe('1001');
  });
});

describe('numeric input helpers', () => {
  it('parses decimals tolerating a comma separator', () => {
    expect(parseNumberInput('1,5')).toBe(1.5);
    expect(parseNumberInput('2.5')).toBe(2.5);
    expect(parseNumberInput('  3 ')).toBe(3);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });

  it('serialises numbers back to input strings', () => {
    expect(numberToInput(null)).toBe('');
    expect(numberToInput(undefined)).toBe('');
    expect(numberToInput(5)).toBe('5');
  });
});

describe('initials', () => {
  it('takes up to two leading letters, upper-cased', () => {
    expect(initials('John Doe')).toBe('JD');
    expect(initials('alice')).toBe('A');
    expect(initials('a b c')).toBe('AB');
  });

  it('falls back to "?" for empty names', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});
