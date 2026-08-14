'use client';

import { useEffect, useId, useRef } from 'react';
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
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [open]);

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
