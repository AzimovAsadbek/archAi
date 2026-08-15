import { describe, expect, it } from 'vitest';
import { emptyProposal } from '../../schemas/proposal.schema';
import { correctionInstruction, parseProposal } from '../proposal-parsing';

const VALID = JSON.stringify(emptyProposal('en'));

describe('parseProposal', () => {
  it('accepts valid JSON that matches the proposal schema', () => {
    const result = parseProposal(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.detectedLanguage).toBe('en');
  });

  it('strips markdown code fences a model may wrap JSON in', () => {
    expect(parseProposal('```json\n' + VALID + '\n```').ok).toBe(true);
    expect(parseProposal('```\n' + VALID + '\n```').ok).toBe(true);
  });

  it('reports non-JSON output distinctly from schema violations', () => {
    const result = parseProposal('here is your project, sure!');
    expect(result).toMatchObject({ ok: false, kind: 'not_json' });
  });

  it('reports schema violations with a structural, user-text-free detail', () => {
    const bad = JSON.stringify({ ...emptyProposal('en'), detectedLanguage: 'xx' });
    const result = parseProposal(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('schema');
      expect(result.detail).toContain('detectedLanguage');
    }
  });

  it('rejects out-of-bounds numbers the wire schema might drop', () => {
    const bad = JSON.stringify({
      ...emptyProposal('en'),
      house: { widthM: 999, lengthM: 5, floorCount: 1, style: null },
    });
    expect(parseProposal(bad).ok).toBe(false);
  });
});

describe('correctionInstruction', () => {
  it('names the problems and demands JSON only', () => {
    const message = correctionInstruction('detectedLanguage: invalid_enum_value');
    expect(message).toContain('detectedLanguage');
    expect(message.toLowerCase()).toContain('json');
  });
});
