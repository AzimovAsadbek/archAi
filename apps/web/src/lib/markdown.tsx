import { type ReactNode } from 'react';

/**
 * A deliberately tiny, safe markdown renderer for admin-authored blog bodies.
 *
 * SAFETY — the whole reason this exists instead of a library with `html: true`:
 * it NEVER produces raw HTML and NEVER touches `dangerouslySetInnerHTML`. Every
 * piece of source text is handed to React as a string child or as the text of a
 * React element, so React escapes it. A body containing `<script>…</script>` or
 * `<img onerror=…>` therefore renders as the literal characters — it cannot
 * execute. Link targets are additionally restricted to http/https/mailto and
 * in-site paths, so `[x](javascript:…)` degrades to plain text.
 *
 * Supported: `#`/`##`/`###` headings, `- ` bullet lists, `**bold**`, `*italic*`,
 * `[text](url)` links, and blank-line-separated paragraphs. Anything else is
 * passed through as plain text.
 *
 * Pure and hook-free on purpose: the same component renders on the server (blog
 * article) and in the client admin live preview.
 */

/** Only these schemes/relative forms may become an `href`; everything else is text. */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (url === '') return null;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  // In-site links and fragments are safe; scheme-relative `//host` is not.
  if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('#')) return url;
  return null;
}

// [text](url) | **bold** | *italic*  — first alternative that matches wins.
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/** Parses inline spans into React nodes. String children are auto-escaped by React. */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let token = 0;

  for (let match = INLINE.exec(text); match !== null; match = INLINE.exec(text)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${token++}`;

    if (match[1] !== undefined && match[2] !== undefined) {
      const href = safeHref(match[2]);
      if (href === null) {
        // Unsafe target → show the source literally rather than a dead/dangerous link.
        nodes.push(match[0]);
      } else {
        const external = /^(https?:|mailto:)/i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            className="font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
          >
            {match[1]}
          </a>,
        );
      }
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={key} className="font-bold text-ink">
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>);
    }

    lastIndex = INLINE.lastIndex;
  }
  INLINE.lastIndex = 0;

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;

/** Body title is an `<h1>`, so markdown headings start at `<h2>` for a sane outline. */
const HEADING_TAGS = { 1: 'h2', 2: 'h3', 3: 'h4' } as const;
const HEADING_CLASS = {
  1: 'mt-8 mb-3 text-xl font-extrabold tracking-tight text-ink',
  2: 'mt-6 mb-2.5 text-lg font-bold tracking-tight text-ink',
  3: 'mt-5 mb-2 text-base font-bold text-ink',
} as const;

export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(
      <p key={`p-${key++}`} className="my-3 leading-relaxed text-ink-soft">
        {parseInline(text, `p-${key}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-3 flex flex-col gap-1.5 pl-5">
        {items.map((item, index) => (
          <li key={index} className="list-disc leading-relaxed text-ink-soft marker:text-ink-faint">
            {parseInline(item, `li-${key}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = ((heading[1] ?? '#').length as 1 | 2 | 3);
      const Tag = HEADING_TAGS[level];
      blocks.push(
        <Tag key={`h-${key++}`} className={HEADING_CLASS[level]}>
          {parseInline(heading[2] ?? '', `h-${key}`)}
        </Tag>,
      );
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1] ?? '');
      continue;
    }

    // Plain line: part of the current soft-wrapped paragraph.
    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** Renders {@link renderMarkdown} output. `source` is markdown, never HTML. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={className}>{renderMarkdown(source)}</div>;
}
