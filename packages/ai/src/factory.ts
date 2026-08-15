import { GeminiArchitectureAIProvider, type GeminiProviderOptions } from './providers/gemini.provider';
import { GroqArchitectureAIProvider, type GroqProviderOptions } from './providers/groq.provider';
import { MockArchitectureAIProvider } from './providers/mock.provider';
import { UnconfiguredArchitectureAIProvider } from './providers/unconfigured.provider';
import { RoutingArchitectureAIProvider } from './router';
import { type ArchitectureAIProvider } from './types';

export const AI_PROVIDER_NAMES = ['gemini', 'groq', 'mock'] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export interface CreateArchitectureAIProviderOptions {
  /** `AI_PROVIDER` — the primary. Defaults to `gemini`. */
  provider?: string;
  /** `AI_FALLBACK_PROVIDER` — used only at runtime when the primary errors. */
  fallbackProvider?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  /** `AI_PRIMARY_MODEL` / `AI_FALLBACK_MODEL` overrides. */
  primaryModel?: string;
  fallbackModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Pre-built SDK clients for tests. */
  clients?: { gemini?: GeminiProviderOptions['client']; groq?: GroqProviderOptions['client'] };
}

interface ProviderContext extends CreateArchitectureAIProviderOptions {
  model?: string;
}

/**
 * Builds one named provider, or `null` when it cannot be configured (its key is
 * missing and no test client was injected). `mock` needs no key.
 */
function makeProvider(name: string, ctx: ProviderContext): ArchitectureAIProvider | null {
  switch (name.trim().toLowerCase()) {
    case 'mock':
      return new MockArchitectureAIProvider({ model: ctx.model });
    case 'gemini':
      if (ctx.geminiApiKey || ctx.clients?.gemini) {
        return new GeminiArchitectureAIProvider({
          apiKey: ctx.geminiApiKey ?? '',
          model: ctx.model,
          timeoutMs: ctx.timeoutMs,
          client: ctx.clients?.gemini,
        });
      }
      return null;
    case 'groq':
      if (ctx.groqApiKey || ctx.clients?.groq) {
        return new GroqArchitectureAIProvider({
          apiKey: ctx.groqApiKey ?? '',
          model: ctx.model,
          timeoutMs: ctx.timeoutMs,
          client: ctx.clients?.groq,
        });
      }
      return null;
    default:
      return null;
  }
}

/**
 * Single entry point for wiring runtime AI. Free-tier-first and provider-
 * agnostic: it returns a `RoutingArchitectureAIProvider` around the configured
 * primary (and fallback, when both are configured). When the *primary* cannot be
 * configured it returns the unconfigured provider — the app still boots and the
 * AI endpoint answers an honest `AI_NOT_CONFIGURED`, never a silent fallback
 * dressed up as healthy.
 */
export function createArchitectureAIProvider(
  options: CreateArchitectureAIProviderOptions = {},
): ArchitectureAIProvider {
  const primaryName = options.provider?.trim() || 'gemini';
  const primary = makeProvider(primaryName, { ...options, model: options.primaryModel });
  if (primary === null) {
    return new UnconfiguredArchitectureAIProvider();
  }

  const fallbackName = options.fallbackProvider?.trim().toLowerCase();
  const wantsFallback =
    fallbackName !== undefined &&
    fallbackName.length > 0 &&
    fallbackName !== 'none' &&
    fallbackName !== primaryName.trim().toLowerCase();
  const fallback = wantsFallback
    ? (makeProvider(fallbackName, { ...options, model: options.fallbackModel }) ?? undefined)
    : undefined;

  return new RoutingArchitectureAIProvider({
    primary,
    fallback,
    maxRetries: options.maxRetries,
  });
}
