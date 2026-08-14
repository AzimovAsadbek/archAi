import { type ArchitectureAIProvider, createArchitectureAIProvider } from '@archai/ai';
import { Logger, type Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ARCHITECTURE_AI_PROVIDER } from './ai.constants';

/**
 * Binds the AI provider chosen by the environment. Without `ANTHROPIC_API_KEY`
 * the factory yields the unconfigured provider, so the app still boots and the
 * missing key surfaces as a 503 on the AI endpoint only.
 */
export const architectureAIProvider: Provider = {
  provide: ARCHITECTURE_AI_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): ArchitectureAIProvider => {
    const provider = createArchitectureAIProvider({
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
    });
    if (provider.name === 'unconfigured') {
      new Logger('AiModule').warn(
        'ANTHROPIC_API_KEY is not set — AI endpoints will answer 503 AI_NOT_CONFIGURED',
      );
    }
    return provider;
  },
};
