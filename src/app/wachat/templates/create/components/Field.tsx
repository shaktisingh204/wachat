import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
      <label
        className={cx('block text-[11px] font-medium uppercase tracking-wide')}
        style={{ color: 'var(--st-text-secondary)' }}
      >
        {label}{' '}
        {required && (
          <span style={{ color: 'var(--st-danger)' }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="text-[11px]" style={{ color: 'var(--st-text-tertiary)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
