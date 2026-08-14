'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Search, SearchX, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

/**
 * The four admin screens are the same object: a filtered, paginated table. These
 * are the pieces they share, so a column added on one screen cannot drift from
 * the spacing and states of the others.
 */

export const TH_CLASS =
  'px-4 py-2.5 text-left text-xs font-bold whitespace-nowrap text-ink-faint uppercase';
export const TD_CLASS = 'px-4 py-3 align-middle';

export function AdminPageHeader({
  title,
  description,
  meta,
  action,
}: {
  title: string;
  description?: string;
  /** Short numeric line under the title, e.g. the row count. */
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p>
        ) : null}
        {meta ? <p className="numeric mt-1.5 text-sm text-ink-soft">{meta}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AdminFilters({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">{children}</div>;
}

export function AdminSearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}

/** Table frame: rounded card outside, horizontal scroll inside on narrow screens. */
export function TableCard({
  caption,
  head,
  children,
  minWidth = 'min-w-3xl',
}: {
  caption: string;
  head: ReactNode;
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-md border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className={cn('w-full border-collapse text-sm', minWidth)}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-paper/60">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="mt-6 overflow-hidden rounded-md border border-line bg-surface">
      <div className="border-b border-line bg-paper/60 px-4 py-3">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className={cn('h-4 flex-1', column === 0 && 'flex-[2]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  const t = useTranslations('admin.table');

  return (
    <EmptyState
      className="mt-6"
      tone="danger"
      icon={<TriangleAlert className="size-5" />}
      title={t('error.title')}
      description={message}
      action={
        <Button variant="outline" onClick={onRetry}>
          {t('error.retry')}
        </Button>
      }
    />
  );
}

export function NoResultsState({ onReset }: { onReset: () => void }) {
  const t = useTranslations('admin.table');

  return (
    <EmptyState
      className="mt-6"
      icon={<SearchX className="size-5" />}
      title={t('noResults.title')}
      description={t('noResults.body')}
      action={
        <Button variant="outline" onClick={onReset}>
          {t('noResults.reset')}
        </Button>
      }
    />
  );
}

export function AdminPagination({
  page,
  pageCount,
  busy = false,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('admin.table');
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={t('pagination.label')}
      className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || busy}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t('pagination.prev')}
      </Button>
      <p className="numeric text-sm text-ink-soft">
        {t('pagination.info', { page, pages: pageCount })}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount || busy}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
      >
        {t('pagination.next')}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
