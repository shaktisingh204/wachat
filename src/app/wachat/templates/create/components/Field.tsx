import * as React from 'react';

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}{' '}
        {required && (
          <span className="text-[var(--st-danger)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-[var(--st-text-tertiary)]">
          {hint}
        </p>
      )}
    </div>
  );
}
