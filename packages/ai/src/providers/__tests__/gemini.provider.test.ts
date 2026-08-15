import { type GoogleGenAI } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { emptyProposal } from '../../schemas/proposal.schema';
import { AI_ERROR_CODES } from '../../types';
import { GeminiArchitectureAIProvider } from '../gemini.provider';

const VALID = JSON.stringify(emptyProposal('en'));
const SCHEMA_INVALID = JSON.stringify({ ...emptyProposal('en'), detectedLanguage: 'zz' });

function response(text: string, extra: Record<string, unknown> = {}): unknown {
  return {
    text,
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    candidates: [{ finishReason: 'STOP' }],
    ...extra,
  };
}

function fakeGemini(handler: () => unknown): GoogleGenAI {
  return {
    models: { generateContent: () => Promise.resolve(handler()) },
  } as unknown as GoogleGenAI;
}

function provider(client: GoogleGenAI): GeminiArchitectureAIProvider {
  return new GeminiArchitectureAIProvider({ apiKey: 'test', client });
}

describe('GeminiArchitectureAIProvider', () => {
  it('parses a valid structured response and records provenance', async () => {
    const result = await provider(fakeGemini(() => response(VALID))).parseProjectRequest({
      text: '2-floor modern house',
      localeHint: 'en',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.detectedLanguage).toBe('en');
      expect(result.provenance.provider).toBe('gemini');
      expect(result.provenance.inputTokens).toBe(10);
      expect(result.provenance.outputTokens).toBe(20);
    }
  });

  it('runs exactly one correction pass on a schema miss, then succeeds', async () => {
    let calls = 0;
    const result = await provider(
      fakeGemini(() => {
        calls++;
        return response(calls === 1 ? SCHEMA_INVALID : VALID);
      }),
    ).parseProjectRequest({ text: 'hi' });
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provenance.outputTokens).toBe(40); // both attempts counted
  });

  it('returns AI_INVALID_OUTPUT when the correction also fails', async () => {
    const result = await provider(fakeGemini(() => response(SCHEMA_INVALID))).parseProjectRequest({
      text: 'hi',
    });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_INVALID_OUTPUT });
  });

  it('maps a 429 to AI_RATE_LIMITED', async () => {
    const client = fakeGemini(() => {
      throw Object.assign(new Error('rate limited'), { status: 429 });
    });
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_RATE_LIMITED });
  });

  it('maps an aborted request to AI_TIMEOUT', async () => {
    const client = fakeGemini(() => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    });
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_TIMEOUT });
  });

  it('maps invalid credentials to AI_PROVIDER_ERROR', async () => {
    const client = fakeGemini(() => {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    });
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_PROVIDER_ERROR });
  });

  it('treats a safety block as AI_REFUSED', async () => {
    const client = fakeGemini(() => response('', { promptFeedback: { blockReason: 'SAFETY' } }));
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_REFUSED });
  });

  it('treats an empty response as AI_INVALID_OUTPUT', async () => {
    const result = await provider(fakeGemini(() => response(''))).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_INVALID_OUTPUT });
  });
});
