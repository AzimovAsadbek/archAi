import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createArchitectureAIProvider } from '../factory';
import { AnthropicArchitectureAIProvider } from '../providers/anthropic.provider';
import { UnconfiguredArchitectureAIProvider } from '../providers/unconfigured.provider';

const fakeClient = {} as unknown as Anthropic;

describe('createArchitectureAIProvider', () => {
  it.each([
    ['no options at all', undefined],
    ['an absent key', {}],
    ['an empty key', { apiKey: '' }],
    ['a whitespace-only key', { apiKey: '   ' }],
  ])('returns the unconfigured provider with %s', (_label, options) => {
    const provider = createArchitectureAIProvider(options);

    expect(provider).toBeInstanceOf(UnconfiguredArchitectureAIProvider);
    expect(provider.name).toBe('unconfigured');
  });

  it('returns the Anthropic provider once a key is present', () => {
    const provider = createArchitectureAIProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-opus-5',
    });

    expect(provider).toBeInstanceOf(AnthropicArchitectureAIProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('accepts an injected client without a key (tests)', () => {
    const provider = createArchitectureAIProvider({ client: fakeClient });

    expect(provider).toBeInstanceOf(AnthropicArchitectureAIProvider);
  });
});

describe('UnconfiguredArchitectureAIProvider', () => {
  it('fails with AI_NOT_CONFIGURED and still reports provenance', async () => {
    const result = await new UnconfiguredArchitectureAIProvider().parseProjectRequest({
      text: '8 sotix yer',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe('AI_NOT_CONFIGURED');
    expect(result.message).toContain('ANTHROPIC_API_KEY');
    expect(result.provenance).toMatchObject({ provider: 'unconfigured', model: 'none' });
  });
});
