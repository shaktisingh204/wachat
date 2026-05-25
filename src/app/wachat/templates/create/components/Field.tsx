import * as React from 'react';
import { Label } from '@/components/zoruui';

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
      <Label className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
        {label} {required && <span className="text-zoru-danger">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] text-zoru-ink-muted">{hint}</p>
      )}
    </div>
  );
}
