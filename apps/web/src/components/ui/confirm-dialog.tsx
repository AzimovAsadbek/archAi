'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Element focus returns to on close — pass the control that opened the dialog
   * (e.g. the ⋯ menu button). When the dialog is opened from a menu item, that
   * item has already unmounted by `showModal()` time, so capturing
   * `document.activeElement` restores focus to `<body>` instead. An explicit ref
   * fixes that; without one, the active element at open time is the fallback.
   */
  triggerRef?: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  pending = false,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fallbackRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      fallbackRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      const restoreTo = triggerRef?.current ?? fallbackRef.current;
      restoreTo?.focus();
      fallbackRef.current = null;
    }
  }, [open, triggerRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Escape (and the native close button) fire `cancel` — keep React in charge.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface shadow-card"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
