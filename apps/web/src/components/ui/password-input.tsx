'use client';

import { useId, useState, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';

/**
 * Password field with a reveal toggle.
 *
 * Typing a password blind is the main cause of failed sign-ins, and a strength
 * rule the user cannot see themselves satisfying is worse still. The toggle is
 * a real button: it announces its state through `aria-pressed`, carries a
 * label that changes with that state, and sits in the tab order after the
 * field so a keyboard user reaches it naturally.
 *
 * `aria-live` is deliberately absent — announcing "password shown" on every
 * toggle is noise, and the button's own label already carries the state when
 * focus lands on it.
 */
export function PasswordInput({
  ref,
  ...props
}: Omit<InputProps, 'type' | 'trailing'> & { ref?: Ref<HTMLInputElement> }) {
  const t = useTranslations('auth');
  const [revealed, setRevealed] = useState(false);
  const id = useId();

  return (
    <Input
      ref={ref}
      type={revealed ? 'text' : 'password'}
      // Reveal must never let a manager or the browser cache the plain value
      // under a different field identity, so the name/id stay put.
      trailing={
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          aria-pressed={revealed}
          aria-label={revealed ? t('hidePassword') : t('showPassword')}
          title={revealed ? t('hidePassword') : t('showPassword')}
          aria-controls={id}
          className="flex size-7 items-center justify-center rounded-tool text-ink-faint transition-colors hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      }
      {...props}
    />
  );
}
