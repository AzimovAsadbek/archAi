import { type GoogleGenAI } from '@google/genai';
import type Groq from 'groq-sdk';
import { describe, expect, it } from 'vitest';
import { createArchitectureAIProvider } from '../factory';
import { UnconfiguredArchitectureAIProvider } from '../providers/unconfigured.provider';
import { RoutingArchitectureAIProvider } from '../router';
import { emptyProposal } from '../schemas/proposal.schema';

const VALID = JSON.stringify(emptyProposal('en'));

const geminiThrowing = (status: number): GoogleGenAI =>
  ({
    models: {
      generateContent: () => Promise.reject(Object.assign(new Error('boom'), { status })),
    },
  }) as unknown as GoogleGenAI;

const groqReturning = (content: string): Groq =>
  ({
    chat: {
      completions: {
        create: () =>
          Promise.resolve({
            choices: [{ message: { content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
      },
    },
  }) as unknown as Groq;

describe('createArchitectureAIProvider', () => {
  it('returns the unconfigured provider when the primary key is missing', () => {
    const provider = createArchitectureAIProvider({ provider: 'gemini' });
    expect(provider).toBeInstanceOf(UnconfiguredArchitectureAIProvider);
    expect(provider.name).toBe('unconfigured');
  });

  it('defaults to gemini and wraps it in the router once a key is present', () => {
    const provider = createArchitectureAIProvider({ geminiApiKey: 'k' });
    expect(provider).toBeInstanceOf(RoutingArchitectureAIProvider);
    expect(provider.name).toBe('gemini');
  });

  it('selects groq as the primary when configured', () => {
    const provider = createArchitectureAIProvider({ provider: 'groq', groqApiKey: 'k' });
    expect(provider.name).toBe('groq');
  });

  it('selects the mock provider without any key', () => {
    const provider = createArchitectureAIProvider({ provider: 'mock' });
    expect(provider).toBeInstanceOf(RoutingArchitectureAIProvider);
    expect(provider.name).toBe('mock');
  });

  it('surfaces an honest, provider-agnostic message when unconfigured', async () => {
    const provider = createArchitectureAIProvider({});
    const result = await provider.parseProjectRequest({ text: 'hi' });
    expect(result).toMatchObject({ ok: false, error: 'AI_NOT_CONFIGURED' });
    if (!result.ok) expect(result.message).toContain('GEMINI_API_KEY');
  });

  it('routes to the groq fallback when the gemini primary rate-limits', async () => {
    const provider = createArchitectureAIProvider({
      provider: 'gemini',
      fallbackProvider: 'groq',
      geminiApiKey: 'g',
      groqApiKey: 'q',
      maxRetries: 0,
      clients: { gemini: geminiThrowing(429), groq: groqReturning(VALID) },
    });
    const result = await provider.parseProjectRequest({ text: 'hi', localeHint: 'en' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provenance.provider).toBe('groq');
  });

  it('does not fall back to a provider that is not configured', async () => {
    const provider = createArchitectureAIProvider({
      provider: 'gemini',
      fallbackProvider: 'groq', // no groq key, no client
      geminiApiKey: 'g',
      maxRetries: 0,
      clients: { gemini: geminiThrowing(429) },
    });
    const result = await provider.parseProjectRequest({ text: 'hi' });
    // No fallback available, so the primary's rate-limit surfaces.
    expect(result).toMatchObject({ ok: false, error: 'AI_RATE_LIMITED' });
  });
});
