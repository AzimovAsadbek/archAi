import { describe, expect, it } from 'vitest';
import type Groq from 'groq-sdk';
import { emptyProposal } from '../../schemas/proposal.schema';
import { AI_ERROR_CODES } from '../../types';
import { GroqArchitectureAIProvider } from '../groq.provider';

const VALID = JSON.stringify(emptyProposal('ru'));
const SCHEMA_INVALID = JSON.stringify({ ...emptyProposal('ru'), rooms: 'not-an-array' });

function completion(content: string, finishReason = 'stop'): unknown {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: { prompt_tokens: 7, completion_tokens: 13 },
  };
}

function fakeGroq(handler: () => unknown): Groq {
  return {
    chat: { completions: { create: () => Promise.resolve(handler()) } },
  } as unknown as Groq;
}

function provider(client: Groq): GroqArchitectureAIProvider {
  return new GroqArchitectureAIProvider({ apiKey: 'test', client });
}

describe('GroqArchitectureAIProvider', () => {
  it('parses a valid json_object response and records provenance', async () => {
    const result = await provider(fakeGroq(() => completion(VALID))).parseProjectRequest({
      text: 'дом в 2 этажа',
      localeHint: 'ru',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.detectedLanguage).toBe('ru');
      expect(result.provenance.provider).toBe('groq');
      expect(result.provenance.inputTokens).toBe(7);
    }
  });

  it('runs one correction pass on a schema miss, then succeeds', async () => {
    let calls = 0;
    const result = await provider(
      fakeGroq(() => {
        calls++;
        return completion(calls === 1 ? SCHEMA_INVALID : VALID);
      }),
    ).parseProjectRequest({ text: 'hi' });
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it('maps a 429 to AI_RATE_LIMITED', async () => {
    const client = fakeGroq(() => {
      throw Object.assign(new Error('Too Many Requests'), { status: 429 });
    });
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_RATE_LIMITED });
  });

  it('maps an aborted request to AI_TIMEOUT', async () => {
    const client = fakeGroq(() => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    const result = await provider(client).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_TIMEOUT });
  });

  it('treats a content_filter finish reason as AI_REFUSED', async () => {
    const result = await provider(
      fakeGroq(() => completion(VALID, 'content_filter')),
    ).parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: AI_ERROR_CODES.AI_REFUSED });
  });
});
