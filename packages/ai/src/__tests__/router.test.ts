import { describe, expect, it } from 'vitest';
import { MockArchitectureAIProvider } from '../providers/mock.provider';
import { RoutingArchitectureAIProvider } from '../router';
import { emptyProposal } from '../schemas/proposal.schema';
import { AI_ERROR_CODES, type AiErrorCode, type ParseProjectResult } from '../types';

const ok = (provider: string): ParseProjectResult => ({
  ok: true,
  proposal: emptyProposal('en'),
  provenance: { provider, model: 'm', promptVersion: '1', durationMs: 1 },
});
const fail = (error: AiErrorCode): ParseProjectResult => ({ ok: false, error, message: 'diagnostic' });

const noSleep = async (): Promise<void> => {};

function counting(name: string, result: () => ParseProjectResult) {
  const state = { calls: 0 };
  const provider = new MockArchitectureAIProvider({
    name,
    respond: () => {
      state.calls++;
      return result();
    },
  });
  return { provider, state };
}

describe('RoutingArchitectureAIProvider', () => {
  it('returns the primary result and never touches the fallback on success', async () => {
    const primary = counting('gemini', () => ok('gemini'));
    const fallback = counting('groq', () => ok('groq'));
    const router = new RoutingArchitectureAIProvider({
      primary: primary.provider,
      fallback: fallback.provider,
      sleep: noSleep,
    });

    const result = await router.parseProjectRequest({ text: 'hi' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provenance.provider).toBe('gemini');
    expect(fallback.state.calls).toBe(0);
    expect(router.name).toBe('gemini');
  });

  it('falls back to the secondary on a rate limit', async () => {
    const primary = counting('gemini', () => fail(AI_ERROR_CODES.AI_RATE_LIMITED));
    const fallback = counting('groq', () => ok('groq'));
    const router = new RoutingArchitectureAIProvider({
      primary: primary.provider,
      fallback: fallback.provider,
      maxRetries: 0,
      sleep: noSleep,
    });

    const result = await router.parseProjectRequest({ text: 'hi' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provenance.provider).toBe('groq');
    expect(primary.state.calls).toBe(1); // rate limit is not same-provider retryable
    expect(fallback.state.calls).toBe(1);
  });

  it('does NOT fall back on an app fault (invalid output)', async () => {
    const primary = counting('gemini', () => fail(AI_ERROR_CODES.AI_INVALID_OUTPUT));
    const fallback = counting('groq', () => ok('groq'));
    const router = new RoutingArchitectureAIProvider({
      primary: primary.provider,
      fallback: fallback.provider,
      sleep: noSleep,
    });

    const result = await router.parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_INVALID_OUTPUT });
    expect(fallback.state.calls).toBe(0);
  });

  it('does NOT fall back on a refusal', async () => {
    const primary = counting('gemini', () => fail(AI_ERROR_CODES.AI_REFUSED));
    const fallback = counting('groq', () => ok('groq'));
    const router = new RoutingArchitectureAIProvider({
      primary: primary.provider,
      fallback: fallback.provider,
      sleep: noSleep,
    });
    await router.parseProjectRequest({ text: 'hi' });
    expect(fallback.state.calls).toBe(0);
  });

  it('retries the same provider on a timeout before falling back', async () => {
    const primary = counting('gemini', () => fail(AI_ERROR_CODES.AI_TIMEOUT));
    const fallback = counting('groq', () => ok('groq'));
    const router = new RoutingArchitectureAIProvider({
      primary: primary.provider,
      fallback: fallback.provider,
      maxRetries: 2,
      backoffMs: 0,
      sleep: noSleep,
    });

    const result = await router.parseProjectRequest({ text: 'hi' });
    expect(primary.state.calls).toBe(3); // initial + 2 retries
    expect(fallback.state.calls).toBe(1);
    if (result.ok) expect(result.provenance.provider).toBe('groq');
  });

  it('returns the primary failure when no fallback is configured', async () => {
    const primary = counting('gemini', () => fail(AI_ERROR_CODES.AI_RATE_LIMITED));
    const router = new RoutingArchitectureAIProvider({ primary: primary.provider, sleep: noSleep });
    const result = await router.parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_RATE_LIMITED });
  });
});
