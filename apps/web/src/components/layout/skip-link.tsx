import { useTranslations } from 'next-intl';

/**
 * First focusable element on the page: lets keyboard and screen-reader users
 * jump past the header/nav straight to the main landmark. Visually hidden until
 * focused. Works in both server and client layouts (no client-only hooks).
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  const t = useTranslations('common');

  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-md focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:inline-flex focus:items-center focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper focus:shadow-card"
    >
      {t('skipToContent')}
    </a>
  );
}
