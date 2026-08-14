import { type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { CONTROL_CLASSES } from './input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_CLASSES, 'resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  );
}
