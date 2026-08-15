import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL } from '@archai/ai';
import { type AppConfigService } from '../config/app-config.service';

/**
 * Resolved runtime-AI wiring, derived from configuration only (never a live
 * probe). Shared by the DI factory (startup log) and the `/ai/status` diagnostic
 * so both describe availability the same way. Carries no secrets — only whether
 * a provider's key is present, never the key itself.
 */
export interface AiWiring {
  provider: string;
  fallbackProvider: string;
  /** The primary provider has everything it needs (a key, or is `mock`). */
  primaryAvailable: boolean;
  /** A distinct, configured fallback with its own key is present. */
  fallbackAvailable: boolean;
  primaryModel: string;
  fallbackModel: string | null;
  dailyRequestLimitPerUser: number;
}

function keyPresent(config: AppConfigService, name: string): boolean {
  switch (name) {
    case 'mock':
      return true;
    case 'gemini':
      return config.geminiApiKey !== undefined;
    case 'groq':
      return config.groqApiKey !== undefined;
    default:
      return false;
  }
}

function defaultModel(name: string): string {
  switch (name) {
    case 'gemini':
      return DEFAULT_GEMINI_MODEL;
    case 'groq':
      return DEFAULT_GROQ_MODEL;
    default:
      return name;
  }
}

export function resolveAiWiring(config: AppConfigService): AiWiring {
  const provider = config.aiProvider;
  const fallbackProvider = config.aiFallbackProvider;
  const fallbackAvailable =
    fallbackProvider !== 'none' &&
    fallbackProvider !== provider &&
    keyPresent(config, fallbackProvider);

  return {
    provider,
    fallbackProvider,
    primaryAvailable: keyPresent(config, provider),
    fallbackAvailable,
    primaryModel: config.aiPrimaryModel ?? defaultModel(provider),
    fallbackModel: fallbackAvailable ? (config.aiFallbackModel ?? defaultModel(fallbackProvider)) : null,
    dailyRequestLimitPerUser: config.aiMaxRequestsPerUserPerDay,
  };
}
