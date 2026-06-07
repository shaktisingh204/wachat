'use client';

import { AlertCircle } from 'lucide-react';

type Props = {
  error: string;
};

/**
 * Inline error message shown under an input field when validation fails.
 * Pure 20ui: danger token for colour (so colour carries meaning) and a
 * lucide icon. Motion is owned by the 20ui system, so it is not hand-rolled
 * here.
 */
export function InputFieldError({ error }: Props) {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--st-danger)]"
    >
      <AlertCircle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="break-words">{error}</span>
    </div>
  );
}
