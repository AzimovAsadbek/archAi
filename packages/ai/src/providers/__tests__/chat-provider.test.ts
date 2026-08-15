import { describe, expect, it } from 'vitest';
import { PARSE_PROJECT_PROMPT_VERSION } from '../../prompts/parse-project';
import { emptyProposal } from '../../schemas/proposal.schema';
import { AI_ERROR_CODES, type ProjectContext } from '../../types';
import { ChatArchitectureAIProvider, type ChatOutcome, type ChatTurn } from '../chat.provider';

const ok = (text: string): ChatOutcome => ({ ok: true, text, inputTokens: 10, outputTokens: 20 });

/** Base provider whose only primitive replays a fixed script of outcomes. */
class ScriptedChatProvider extends ChatArchitectureAIProvider {
  readonly name = 'fake';
  protected readonly model = 'fake-1';
  completeCalls = 0;
  private readonly script: ChatOutcome[];

  constructor(script: ChatOutcome[]) {
    super();
    this.script = [...script];
  }

  protected complete(_system: string, _turns: ChatTurn[]): Promise<ChatOutcome> {
    this.completeCalls++;
    const next = this.script.shift();
    if (next === undefined) throw new Error('scripted provider exhausted — operation called complete too many times');
    return Promise.resolve(next);
  }
}

const PROJECT: ProjectContext = {
  name: 'X',
  land: null,
  house: null,
  rooms: [],
  features: { garage: false, terrace: false, balcony: false, pool: false, garden: false },
};
const validProposal = JSON.stringify(emptyProposal('en'));
const validSuggestions = JSON.stringify({ detectedLanguage: 'en', summary: null, suggestions: [] });
const validAnswer = JSON.stringify({ detectedLanguage: 'en', addressable: true, answer: 'Two floors.' });

describe('ChatArchitectureAIProvider (shared pipeline)', () => {
  it('runs each operation end to end and reports provenance', async () => {
    const parse = await new ScriptedChatProvider([ok(validProposal)]).parseProjectRequest({ text: 'a house' });
    expect(parse.ok).toBe(true);
    if (parse.ok) {
      expect(parse.provenance.provider).toBe('fake');
      expect(parse.provenance.promptVersion).toBe(PARSE_PROJECT_PROMPT_VERSION);
      expect(parse.provenance.inputTokens).toBe(10);
      expect(parse.provenance.outputTokens).toBe(20);
    }

    const suggest = await new ScriptedChatProvider([ok(validSuggestions)]).suggestImprovements({ project: PROJECT });
    expect(suggest.ok).toBe(true);
    if (suggest.ok) expect(suggest.suggestions.suggestions).toEqual([]);

    const answer = await new ScriptedChatProvider([ok(validAnswer)]).answerQuestion({
      project: PROJECT,
      question: 'How many floors?',
    });
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.answer.answer).toBe('Two floors.');
  });

  it('makes exactly one correction pass on a schema miss and totals tokens', async () => {
    const provider = new ScriptedChatProvider([ok('{"unexpected":true}'), ok(validSuggestions)]);
    const result = await provider.suggestImprovements({ project: PROJECT });
    expect(result.ok).toBe(true);
    expect(provider.completeCalls).toBe(2);
    if (result.ok) {
      expect(result.provenance.inputTokens).toBe(20);
      expect(result.provenance.outputTokens).toBe(40);
    }
  });

  it('returns AI_INVALID_OUTPUT when the correction still fails', async () => {
    const provider = new ScriptedChatProvider([ok('{"bad":1}'), ok('{"still":"wrong"}')]);
    const result = await provider.parseProjectRequest({ text: 'a house' });
    expect(result.ok).toBe(false);
    expect(provider.completeCalls).toBe(2);
    if (!result.ok) expect(result.error).toBe(AI_ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it('does not retry non-JSON output (a re-ask would not fix a provider fault)', async () => {
    const provider = new ScriptedChatProvider([ok('this is not json at all')]);
    const result = await provider.answerQuestion({ project: PROJECT, question: 'x' });
    expect(result.ok).toBe(false);
    expect(provider.completeCalls).toBe(1);
    if (!result.ok) expect(result.error).toBe(AI_ERROR_CODES.AI_INVALID_OUTPUT);
  });

  it('passes a provider failure straight through without a correction pass', async () => {
    const provider = new ScriptedChatProvider([
      { ok: false, error: AI_ERROR_CODES.AI_REFUSED, message: 'blocked', inputTokens: 5, outputTokens: 0 },
    ]);
    const result = await provider.suggestImprovements({ project: PROJECT });
    expect(result.ok).toBe(false);
    expect(provider.completeCalls).toBe(1);
    if (!result.ok) {
      expect(result.error).toBe(AI_ERROR_CODES.AI_REFUSED);
      expect(result.provenance?.inputTokens).toBe(5);
    }
  });
});
