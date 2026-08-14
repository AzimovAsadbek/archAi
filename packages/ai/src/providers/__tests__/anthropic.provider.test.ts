import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { PARSE_PROJECT_PROMPT_VERSION } from '../../prompts/parse-project';
import { type ProjectProposal, emptyProposal } from '../../schemas/proposal.schema';
import { AnthropicArchitectureAIProvider, DEFAULT_ANTHROPIC_MODEL } from '../anthropic.provider';

/** The subset of `beta.messages.parse` params the provider actually sends. */
interface ParseParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: string; content: string }[];
  output_format: {
    type: string;
    schema: Record<string, unknown>;
    parse: (content: string) => unknown;
  };
  temperature?: number;
  thinking?: unknown;
}

interface FakeMessage {
  model: string;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
  parsed_output: ProjectProposal | null;
}

const PROPOSAL: ProjectProposal = {
  ...emptyProposal('uz'),
  name: 'Oilaviy uy',
  land: { areaM2: 800, widthM: null, lengthM: null },
  house: { widthM: 12, lengthM: 14, floorCount: 2, style: 'MODERN' },
  rooms: [{ type: 'KITCHEN', floor: 0, widthM: null, lengthM: null, label: null }],
  assumptions: ['8 sotix 800 m² deb hisoblandi'],
};

function message(overrides: Partial<FakeMessage> = {}): FakeMessage {
  return {
    model: DEFAULT_ANTHROPIC_MODEL,
    stop_reason: 'end_turn',
    usage: { input_tokens: 1_200, output_tokens: 340 },
    parsed_output: PROPOSAL,
    ...overrides,
  };
}

let lastParams: ParseParams | null = null;

/** A stand-in for the SDK client: no network, no keys, fully deterministic. */
function fakeClient(handler: (params: ParseParams) => unknown): Anthropic {
  return {
    beta: {
      messages: {
        parse: (params: ParseParams): Promise<unknown> => {
          lastParams = params;
          return Promise.resolve(handler(params));
        },
      },
    },
  } as unknown as Anthropic;
}

function providerWith(handler: (params: ParseParams) => unknown): AnthropicArchitectureAIProvider {
  return new AnthropicArchitectureAIProvider({ apiKey: '', client: fakeClient(handler) });
}

function rateLimitError(): unknown {
  return Anthropic.APIError.generate(429, undefined, 'rate limited', new Headers());
}

describe('AnthropicArchitectureAIProvider', () => {
  beforeEach(() => {
    lastParams = null;
  });

  it('returns the parsed proposal with provenance', async () => {
    const provider = providerWith(() => message());
    const result = await provider.parseProjectRequest({ text: '8 sotix yer', localeHint: 'uz' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.proposal).toEqual(PROPOSAL);
    expect(result.provenance).toMatchObject({
      provider: 'anthropic',
      model: DEFAULT_ANTHROPIC_MODEL,
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
      inputTokens: 1_200,
      outputTokens: 340,
    });
    expect(result.provenance.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('sends a minimal structured-output request', async () => {
    await providerWith(() => message()).parseProjectRequest({ text: '8 sotix yer' });

    expect(lastParams?.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(lastParams?.max_tokens).toBe(16_000);
    expect(lastParams?.output_format.type).toBe('json_schema');
    expect(lastParams?.messages).toHaveLength(1);
    expect(lastParams?.messages[0]?.role).toBe('user');
    expect(lastParams?.messages[0]?.content).toContain('<user_request>');
    // The model rejects sampling params, and thinking is on by default.
    expect(lastParams?.temperature).toBeUndefined();
    expect(lastParams?.thinking).toBeUndefined();
  });

  it('honours a model override', async () => {
    const provider = new AnthropicArchitectureAIProvider({
      apiKey: '',
      model: 'claude-sonnet-5',
      client: fakeClient(() => message({ model: 'claude-sonnet-5' })),
    });
    const result = await provider.parseProjectRequest({ text: '8 sotix yer' });

    expect(lastParams?.model).toBe('claude-sonnet-5');
    expect(result.ok && result.provenance.model).toBe('claude-sonnet-5');
  });

  it('maps a refusal to AI_REFUSED without reading content', async () => {
    const provider = providerWith(() =>
      message({ stop_reason: 'refusal', parsed_output: PROPOSAL }),
    );
    const result = await provider.parseProjectRequest({ text: 'something disallowed' });

    expect(result).toMatchObject({ ok: false, error: 'AI_REFUSED' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provenance?.promptVersion).toBe(PARSE_PROJECT_PROMPT_VERSION);
    }
  });

  it('maps missing structured output to AI_INVALID_OUTPUT', async () => {
    const provider = providerWith(() => message({ parsed_output: null }));
    const result = await provider.parseProjectRequest({ text: '8 sotix yer' });

    expect(result).toMatchObject({ ok: false, error: 'AI_INVALID_OUTPUT' });
  });

  it('maps a truncated response to AI_INVALID_OUTPUT', async () => {
    const provider = providerWith(() => message({ stop_reason: 'max_tokens' }));
    const result = await provider.parseProjectRequest({ text: '8 sotix yer' });

    expect(result).toMatchObject({ ok: false, error: 'AI_INVALID_OUTPUT' });
  });

  it('maps schema-violating output to AI_INVALID_OUTPUT', async () => {
    // The wire schema drops min/max, so the helper's client-side zod check is
    // what catches an out-of-range value — exactly as it does in production.
    const provider = providerWith((params) => {
      params.output_format.parse(
        JSON.stringify({ ...PROPOSAL, land: { areaM2: 99_999, widthM: null, lengthM: null } }),
      );
      return message();
    });
    const result = await provider.parseProjectRequest({ text: '999 sotix yer' });

    expect(result).toMatchObject({ ok: false, error: 'AI_INVALID_OUTPUT' });
  });

  it.each([
    ['a rate limit', rateLimitError, 'AI_RATE_LIMITED'],
    [
      'a connection failure',
      (): unknown => new Anthropic.APIConnectionError({ message: 'socket hang up' }),
      'AI_TIMEOUT',
    ],
    [
      'a timeout',
      (): unknown => new Anthropic.APIConnectionTimeoutError({ message: 'timed out' }),
      'AI_TIMEOUT',
    ],
    [
      'a bad API key',
      (): unknown => Anthropic.APIError.generate(401, undefined, 'invalid key', new Headers()),
      'AI_PROVIDER_ERROR',
    ],
    [
      'an upstream outage',
      (): unknown => Anthropic.APIError.generate(529, undefined, 'overloaded', new Headers()),
      'AI_PROVIDER_ERROR',
    ],
    ['an unexpected failure', (): unknown => new Error('boom'), 'AI_PROVIDER_ERROR'],
  ])('maps %s to %s', async (_label, makeError, expected) => {
    const provider = providerWith(() => {
      throw makeError();
    });
    const result = await provider.parseProjectRequest({ text: '8 sotix yer' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe(expected);
    expect(result.provenance).toMatchObject({
      provider: 'anthropic',
      model: DEFAULT_ANTHROPIC_MODEL,
      promptVersion: PARSE_PROJECT_PROMPT_VERSION,
    });
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('never throws — even a non-Error rejection becomes a result', async () => {
    const provider = providerWith(() => {
      throw 'the SDK threw a string';
    });
    const result = await provider.parseProjectRequest({ text: '8 sotix yer' });

    expect(result).toMatchObject({ ok: false, error: 'AI_PROVIDER_ERROR' });
  });

  it('keeps the user request out of provenance', async () => {
    const secret = 'Chilonzor tumani, 42-uy';
    const provider = providerWith(() => message());
    const result = await provider.parseProjectRequest({ text: secret });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Provenance is persisted — it may only ever describe the run itself.
    expect(Object.keys(result.provenance).sort()).toEqual([
      'durationMs',
      'inputTokens',
      'model',
      'outputTokens',
      'promptVersion',
      'provider',
    ]);
    expect(JSON.stringify(result.provenance)).not.toContain('Chilonzor');
  });
});
