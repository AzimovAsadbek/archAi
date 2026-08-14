'use client';

import { useTranslations } from 'next-intl';
import { CircleCheck, TriangleAlert, XCircle } from 'lucide-react';
import { DOMAIN_ISSUES, type DomainIssue, type DomainIssueCode } from '@archai/shared';
import { cn } from '@/lib/cn';

type IssueValues = Record<string, string | number>;

function num(meta: DomainIssue['meta'], key: string): number {
  const value = meta?.[key];
  return typeof value === 'number' ? value : 0;
}

/**
 * Each domain code owns its placeholder set — every one is always supplied so
 * ICU never renders a missing-argument error.
 */
function issueValues(issue: DomainIssue): IssueValues {
  const meta = issue.meta;
  switch (issue.code) {
    case DOMAIN_ISSUES.HOUSE_EXCEEDS_LAND:
      return { footprintM2: num(meta, 'footprintM2'), landAreaM2: num(meta, 'landAreaM2') };
    case DOMAIN_ISSUES.HOUSE_WIDTH_EXCEEDS_LAND:
    case DOMAIN_ISSUES.HOUSE_LENGTH_EXCEEDS_LAND:
      return { houseM: num(meta, 'houseM'), landM: num(meta, 'landM') };
    case DOMAIN_ISSUES.HIGH_LAND_COVERAGE:
      return { coveragePercent: num(meta, 'coveragePercent') };
    case DOMAIN_ISSUES.LAND_DIMENSIONS_MISMATCH:
      return { areaM2: num(meta, 'areaM2'), rectAreaM2: num(meta, 'rectAreaM2') };
    case DOMAIN_ISSUES.ROOM_ON_MISSING_FLOOR:
      return {
        roomNumber: num(meta, 'roomIndex') + 1,
        floorNumber: num(meta, 'floor') + 1,
        floorCount: num(meta, 'floorCount'),
      };
    case DOMAIN_ISSUES.FLOOR_AREA_EXCEEDED:
      return {
        floorNumber: num(meta, 'floor') + 1,
        usedM2: num(meta, 'usedM2'),
        floorM2: num(meta, 'floorM2'),
      };
    case DOMAIN_ISSUES.FLOOR_NEARLY_FULL:
      return { floorNumber: num(meta, 'floor') + 1, fillPercent: num(meta, 'fillPercent') };
    default:
      return {};
  }
}

const KNOWN_CODES = new Set<string>(Object.values(DOMAIN_ISSUES));

/** Localizes a single domain issue; unknown codes degrade to a generic sentence. */
export function useIssueText(): (issue: DomainIssue) => string {
  const tCodes = useTranslations('validation.codes');
  return (issue: DomainIssue) => {
    const code: DomainIssueCode | 'unknown' = KNOWN_CODES.has(issue.code) ? issue.code : 'unknown';
    return tCodes(code, issueValues(issue));
  };
}

export interface ValidationPanelProps {
  errors: DomainIssue[];
  warnings: DomainIssue[];
  /** Render a success panel when there is nothing to report. */
  showValid?: boolean;
  className?: string;
}

export function ValidationPanel({
  errors,
  warnings,
  showValid = false,
  className,
}: ValidationPanelProps) {
  const t = useTranslations('validation');
  const issueText = useIssueText();

  if (errors.length === 0 && warnings.length === 0) {
    if (!showValid) return null;
    return (
      <div
        className={cn(
          'flex gap-3 rounded-md border border-success/25 bg-success-soft px-4 py-3',
          className,
        )}
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-ink">{t('okTitle')}</p>
          <p className="mt-0.5 text-ink-soft">{t('okBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {errors.length > 0 ? (
        <section
          aria-label={t('errorsTitle')}
          className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-danger">
            <XCircle className="size-4" aria-hidden="true" />
            {t('errorsTitle')}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {errors.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className="flex gap-2 text-sm leading-relaxed text-ink"
              >
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-danger" />
                {issueText(issue)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section
          aria-label={t('warningsTitle')}
          className="rounded-md border border-warning/30 bg-warning-soft px-4 py-3"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
            <TriangleAlert className="size-4" aria-hidden="true" />
            {t('warningsTitle')}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {warnings.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className="flex gap-2 text-sm leading-relaxed text-ink"
              >
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                {issueText(issue)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
