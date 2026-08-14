'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Search } from 'lucide-react';
import { type FaqItemDto } from '@archai/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

export interface FaqGroup {
  category: string | null;
  items: FaqItemDto[];
}

/** Splits a plain-text answer into paragraphs. Rendered as text — never HTML. */
function Answer({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 px-4 pb-4 text-sm leading-relaxed text-ink-soft">
      {paragraphs.length > 0 ? (
        paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
      ) : (
        <p>{text}</p>
      )}
    </div>
  );
}

function FaqEntry({ item }: { item: FaqItemDto }) {
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span>{item.question}</span>
        <ChevronDown
          className="size-4 shrink-0 text-ink-faint transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <Answer text={item.answer} />
    </details>
  );
}

/**
 * Accessible FAQ disclosure built on native `<details>`/`<summary>` — keyboard
 * operable and screen-reader friendly out of the box. The search box is
 * progressive enhancement: with JS it filters the list; the content is already
 * server-rendered, so it is fully readable without JS too.
 */
export function FaqAccordion({ groups }: { groups: FaqGroup[] }) {
  const t = useTranslations('publicContent.faq');
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (needle === '') return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.question.toLowerCase().includes(needle) ||
            item.answer.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, needle]);

  const hasResults = filtered.some((group) => group.items.length > 0);

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      {!hasResults ? (
        <EmptyState
          className="mt-6"
          icon={<Search className="size-5" />}
          title={t('noResults.title')}
          description={t('noResults.body')}
        />
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {filtered.map((group) => (
            <section key={group.category ?? '__general'}>
              <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-faint uppercase">
                {group.category ?? t('generalCategory')}
              </h2>
              <div className="overflow-hidden rounded-md border border-line bg-surface">
                {group.items.map((item) => (
                  <FaqEntry key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
