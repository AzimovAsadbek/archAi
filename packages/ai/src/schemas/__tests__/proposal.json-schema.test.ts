import { describe, expect, it } from 'vitest';
import { HOUSE_STYLES, ROOM_TYPES } from '@archai/shared';
import { PROPOSAL_JSON_SCHEMA } from '../proposal.json-schema';
import { DETECTED_LANGUAGES, projectProposalSchema } from '../proposal.schema';

interface ObjectSchema {
  properties: Record<string, { enum?: unknown[]; items?: { properties?: Record<string, { enum?: unknown[] }> } }>;
  required: string[];
}

const schema = PROPOSAL_JSON_SCHEMA as unknown as ObjectSchema;

describe('PROPOSAL_JSON_SCHEMA (wire schema drift guard)', () => {
  it('exposes exactly the top-level keys of the zod proposal schema, all required', () => {
    const zodKeys = Object.keys(projectProposalSchema.shape).sort();
    expect(Object.keys(schema.properties).sort()).toEqual(zodKeys);
    expect([...schema.required].sort()).toEqual(zodKeys);
  });

  it('mirrors the domain enums so the model is offered the same choices', () => {
    expect(schema.properties.detectedLanguage?.enum).toEqual([...DETECTED_LANGUAGES]);
    expect(schema.properties.rooms?.items?.properties?.type?.enum).toEqual([...ROOM_TYPES]);
    // house is an object, not an array — it has no `items`.
    expect(schema.properties.house?.items).toBeUndefined();
  });

  it('includes every house style plus null in the (nullable) style enum', () => {
    const houseProps = (
      PROPOSAL_JSON_SCHEMA as unknown as {
        properties: { house: { properties: { style: { enum: unknown[] } } } };
      }
    ).properties.house.properties.style.enum;
    expect(houseProps).toEqual([...HOUSE_STYLES, null]);
  });
});
