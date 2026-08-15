import { type ArchitectureAIProvider, createArchitectureAIProvider } from '@archai/ai';
import { Logger, type Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ARCHITECTURE_AI_PROVIDER } from './ai.constants';
import { resolveAiWiring } from './ai.wiring';

/**
 * Binds the runtime AI provider chosen by the environment: `AI_PROVIDER` primary
 * with an optional `AI_FALLBACK_PROVIDER`, keyed by `GEMINI_API_KEY` /
 * `GROQ_API_KEY`. When the primary's key is missing the factory yields the
 * unconfigured provider, so the app still boots and only the AI endpoint answers
 * 503 — never a silent fallback pretending to be healthy.
 */
export const architectureAIProvider: Provider = {
  provide: ARCHITECTURE_AI_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): ArchitectureAIProvider => {
    const provider = createArchitectureAIProvider({
      provider: config.aiProvider,
      fallbackProvider: config.aiFallbackProvider,
      geminiApiKey: config.geminiApiKey,
      groqApiKey: config.groqApiKey,
      primaryModel: config.aiPrimaryModel,
      fallbackModel: config.aiFallbackModel,
      timeoutMs: config.aiTimeoutMs,
      maxRetries: config.aiMaxRetries,
    });

    const logger = new Logger('AiModule');
    const wiring = resolveAiWiring(config);
    if (provider.name === 'unconfigured') {
      logger.warn(
        `AI_PROVIDER=${config.aiProvider} but its API key is missing — AI endpoints answer 503 AI_NOT_CONFIGURED`,
      );
    } else {
      logger.log(
        `Runtime AI: ${wiring.provider} (${wiring.primaryModel})` +
          (wiring.fallbackAvailable
            ? ` with ${wiring.fallbackProvider} fallback (${wiring.fallbackModel})`
            : ' — no fallback configured'),
      );
    }
    return provider;
  },
};
