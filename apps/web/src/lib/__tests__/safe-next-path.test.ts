import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../safe-next-path';

describe('safeNextPath', () => {
  it('returns same-origin absolute paths unchanged, preserving query and hash', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/projects/abc123')).toBe('/projects/abc123');
    expect(safeNextPath('/search?q=house&page=2')).toBe('/search?q=house&page=2');
    expect(safeNextPath('/a/b#section')).toBe('/a/b#section');
    expect(safeNextPath('/')).toBe('/');
  });

  it('takes the first entry when given an array (Next.js repeated query params)', () => {
    expect(safeNextPath(['/dashboard', '/projects'])).toBe('/dashboard');
    expect(safeNextPath(['//evil.com'])).toBe('/dashboard');
  });

  it('falls back for non-string or non-absolute input', () => {
    expect(safeNextPath(undefined)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
    expect(safeNextPath('dashboard')).toBe('/dashboard');
    expect(safeNextPath('relative/path')).toBe('/dashboard');
  });

  it('rejects absolute-URL and scheme-based open redirects', () => {
    expect(safeNextPath('http://evil.com')).toBe('/dashboard');
    expect(safeNextPath('https://evil.com/path')).toBe('/dashboard');
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard');
    expect(safeNextPath('mailto:a@b.com')).toBe('/dashboard');
    expect(safeNextPath('data:text/html,<script>')).toBe('/dashboard');
  });

  it('rejects authority-position tricks the browser reads as a host', () => {
    // Protocol-relative and backslash forms resolve to a different origin.
    expect(safeNextPath('//evil.com')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.com')).toBe('/dashboard');
    expect(safeNextPath('/\\/evil.com')).toBe('/dashboard');
    // `..` normalises to a protocol-relative pathname `//evil.com` that keeps the
    // safe origin yet a browser follows off-site — the explicit `//` guard.
    expect(safeNextPath('/..//evil.com')).toBe('/dashboard');
    expect(safeNextPath('/../..//evil.com')).toBe('/dashboard');
  });

  it('honours a custom fallback', () => {
    expect(safeNextPath('//evil.com', '/login')).toBe('/login');
    expect(safeNextPath(undefined, '/')).toBe('/');
  });
});
