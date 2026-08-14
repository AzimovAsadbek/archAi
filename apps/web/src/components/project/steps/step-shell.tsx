import { type ReactNode } from 'react';
import { type DraftState } from '@/lib/draft-project';

export interface StepProps {
  draft: DraftState;
  update: (patchOrFn: Partial<DraftState> | ((current: DraftState) => Partial<DraftState>)) => void;
  /** Localized field errors keyed by dotted path (e.g. `rooms.0.widthM`). */
  errors: Record<string, string | undefined>;
  disabled: boolean;
}

export function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="border-b border-line pb-5">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
      </header>
      <div className="pt-6">{children}</div>
    </section>
  );
}
