import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicArchitectureAIProvider } from './providers/anthropic.provider';
import { UnconfiguredArchitectureAIProvider } from './providers/unconfigured.provider';
import { type ArchitectureAIProvider } from './types';

export interface CreateArchitectureAIProviderOptions {
  /** `ANTHROPIC_API_KEY`. Empty or missing selects the unconfigured provider. */
  apiKey?: string;
  /** `ANTHROPIC_MODEL` override. */
  model?: string;
  /** Pre-built client (tests). Selects the Anthropic provider even without a key. */
  client?: Anthropic;
}

/**
 * Single entry point for wiring AI into an application. Without a key it returns
 * a provider that fails with `AI_NOT_CONFIGURED` — the app still boots, and the
 * missing key surfaces as an honest error instead of a crash at startup.
 */
export function createArchitectureAIProvider(
  options: CreateArchitectureAIProviderOptions = {},
): ArchitectureAIProvider {
  const apiKey = options.apiKey?.trim() ?? '';
  if (apiKey.length === 0 && options.client === undefined) {
    return new UnconfiguredArchitectureAIProvider();
  }
  return new AnthropicArchitectureAIProvider({
    apiKey,
    model: options.model,
    client: options.client,
  });
}
