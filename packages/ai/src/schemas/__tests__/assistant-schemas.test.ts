import { describe, expect, it } from 'vitest';
import {
  ANSWER_JSON_SCHEMA,
  ANSWER_LIMITS,
  answerOutputSchema,
} from '../answer.schema';
import {
  SUGGESTION_LIMITS,
  SUGGESTIONS_JSON_SCHEMA,
  suggestionsOutputSchema,
} from '../suggestions.schema';

const validSuggestion = {
  category: 'ROOM' as const,
  title: 'Add a bathroom on the ground floor',
  detail: 'The ground floor has no bathroom; guests would otherwise use the upstairs one.',
  priority: 'HIGH' as const,
};

describe('suggestionsOutputSchema', () => {
  it('accepts a well-formed advisory response, including an empty list', () => {
    expect(
      suggestionsOutputSchema.safeParse({
        detectedLanguage: 'en',
        summary: 'A solid starting point.',
        suggestions: [validSuggestion],
      }).success,
    ).toBe(true);
    expect(
      suggestionsOutputSchema.safeParse({ detectedLanguage: 'uz', summary: null, suggestions: [] }).success,
    ).toBe(true);
  });

  it('rejects an unknown category or priority', () => {
    expect(
      suggestionsOutputSchema.safeParse({
        detectedLanguage: 'en',
        summary: null,
        suggestions: [{ ...validSuggestion, category: 'PLUMBING' }],
      }).success,
    ).toBe(false);
    expect(
      suggestionsOutputSchema.safeParse({
        detectedLanguage: 'en',
        summary: null,
        suggestions: [{ ...validSuggestion, priority: 'URGENT' }],
      }).success,
    ).toBe(false);
  });

  it('caps the number of suggestions and the field lengths', () => {
    const tooMany = Array.from({ length: SUGGESTION_LIMITS.maxSuggestions + 1 }, () => validSuggestion);
    expect(
      suggestionsOutputSchema.safeParse({ detectedLanguage: 'en', summary: null, suggestions: tooMany }).success,
    ).toBe(false);

    const longTitle = { ...validSuggestion, title: 'x'.repeat(SUGGESTION_LIMITS.maxTitleChars + 1) };
    expect(
      suggestionsOutputSchema.safeParse({ detectedLanguage: 'en', summary: null, suggestions: [longTitle] }).success,
    ).toBe(false);
  });

  it('exposes a JSON Schema object for the prompt', () => {
    expect(typeof SUGGESTIONS_JSON_SCHEMA).toBe('object');
    expect(JSON.stringify(SUGGESTIONS_JSON_SCHEMA)).toContain('suggestions');
  });
});

describe('answerOutputSchema', () => {
  it('accepts an addressable answer and a refusal redirect', () => {
    expect(
      answerOutputSchema.safeParse({ detectedLanguage: 'en', addressable: true, answer: 'Two floors.' }).success,
    ).toBe(true);
    expect(
      answerOutputSchema.safeParse({
        detectedLanguage: 'ru',
        addressable: false,
        answer: 'Я могу помочь только с вопросами о вашем проекте.',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty or over-long answer', () => {
    expect(answerOutputSchema.safeParse({ detectedLanguage: 'en', addressable: true, answer: '' }).success).toBe(false);
    expect(
      answerOutputSchema.safeParse({
        detectedLanguage: 'en',
        addressable: true,
        answer: 'x'.repeat(ANSWER_LIMITS.maxAnswerChars + 1),
      }).success,
    ).toBe(false);
  });

  it('exposes a JSON Schema object for the prompt', () => {
    expect(typeof ANSWER_JSON_SCHEMA).toBe('object');
    expect(JSON.stringify(ANSWER_JSON_SCHEMA)).toContain('addressable');
  });
});
