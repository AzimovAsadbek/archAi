'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { LIMITS } from '@archai/shared';
import { ApiError } from './api';

/**
 * Shared zod schemas carry stable snake_case message keys (see CLAUDE.md).
 * The bounds live in `LIMITS`, so translations interpolate instead of hardcoding
 * numbers that would drift from the domain package.
 */
export type FieldErrorParams = Record<string, number>;

const NO_BOUNDS: FieldErrorParams = { min: 0, max: 0 };

const FIELD_ERROR_PARAMS: Record<string, FieldErrorParams> = {
  required: NO_BOUNDS,
  invalid: NO_BOUNDS,
  invalid_email: NO_BOUNDS,
  number_required: NO_BOUNDS,
  password_weak: NO_BOUNDS,
  password_min: { min: LIMITS.auth.passwordMin, max: LIMITS.auth.passwordMax },
  password_max: { min: LIMITS.auth.passwordMin, max: LIMITS.auth.passwordMax },
  full_name_min: { min: LIMITS.auth.fullNameMin, max: LIMITS.auth.fullNameMax },
  full_name_max: { min: LIMITS.auth.fullNameMin, max: LIMITS.auth.fullNameMax },
  name_min: { min: LIMITS.project.nameMin, max: LIMITS.project.nameMax },
  name_max: { min: LIMITS.project.nameMin, max: LIMITS.project.nameMax },
  description_max: { min: 0, max: LIMITS.project.descriptionMax },
  land_area_min: { min: LIMITS.land.minAreaM2, max: LIMITS.land.maxAreaM2 },
  land_area_max: { min: LIMITS.land.minAreaM2, max: LIMITS.land.maxAreaM2 },
  land_side_min: { min: LIMITS.land.minSideM, max: LIMITS.land.maxSideM },
  land_side_max: { min: LIMITS.land.minSideM, max: LIMITS.land.maxSideM },
  house_side_min: { min: LIMITS.house.minSideM, max: LIMITS.house.maxSideM },
  house_side_max: { min: LIMITS.house.minSideM, max: LIMITS.house.maxSideM },
  floors_min: { min: LIMITS.floors.min, max: LIMITS.floors.max },
  floors_max: { min: LIMITS.floors.min, max: LIMITS.floors.max },
  room_side_min: { min: LIMITS.rooms.minSideM, max: LIMITS.rooms.maxSideM },
  room_side_max: { min: LIMITS.rooms.minSideM, max: LIMITS.rooms.maxSideM },
  too_many_rooms: { min: 1, max: LIMITS.rooms.maxPerProject },
};

const KEY_PATTERN = /^[a-z0-9_]+$/;

/** Localizes a stable schema message key; unknown keys fall back to a generic one. */
export function useFieldError(): (message?: string | null) => string | undefined {
  const t = useTranslations('fieldErrors');

  return useCallback(
    (message?: string | null) => {
      if (!message) return undefined;
      const key = KEY_PATTERN.test(message) ? message : 'invalid';
      const params = FIELD_ERROR_PARAMS[key] ?? NO_BOUNDS;
      if (!t.has(key)) return t('invalid', NO_BOUNDS);
      return t(key, params);
    },
    [t],
  );
}

export interface ApiFieldIssue {
  /** Dotted path of the offending field, e.g. `house.widthM`. */
  path: string;
  /** Stable schema message key. */
  message: string;
}

interface RawZodIssue {
  path?: unknown;
  message?: unknown;
}

/** Extracts field issues from a 400 VALIDATION_ERROR response. */
export function readApiFieldIssues(error: unknown): ApiFieldIssue[] {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return [];
  if (!Array.isArray(error.details)) return [];

  return (error.details as RawZodIssue[]).flatMap((issue) => {
    if (typeof issue?.message !== 'string') return [];
    const path = Array.isArray(issue.path) ? issue.path.map((part) => String(part)).join('.') : '';
    return [{ path, message: issue.message }];
  });
}
