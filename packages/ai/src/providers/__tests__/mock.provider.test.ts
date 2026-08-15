import { describe, expect, it } from 'vitest';
import { AI_ERROR_CODES } from '../../types';
import { MockArchitectureAIProvider } from '../mock.provider';

describe('MockArchitectureAIProvider', () => {
  it('returns a deterministic, schema-valid proposal by default', async () => {
    const provider = new MockArchitectureAIProvider();
    const result = await provider.parseProjectRequest({ text: 'a modern 2-floor house', localeHint: 'en' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.detectedLanguage).toBe('en');
      expect(result.provenance.provider).toBe('mock');
    }
  });

  it('honours an injected name and respond() for router/failure scenarios', async () => {
    let calls = 0;
    const provider = new MockArchitectureAIProvider({
      name: 'primary',
      respond: (_input, callIndex) => {
        calls++;
        return { ok: false, error: AI_ERROR_CODES.AI_TIMEOUT, message: `attempt ${callIndex}` };
      },
    });
    const result = await provider.parseProjectRequest({ text: 'hi' });
    expect(provider.name).toBe('primary');
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_TIMEOUT });
    expect(calls).toBe(1);
  });
});
