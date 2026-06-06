'use client';

import { Card, Checkbox, Label } from '@/components/sabcrm/20ui/compat';
/**
 * Shared form primitives used by the item-form sections.
 *
 * Pulled out so both `items-form-sections.tsx` and
 * `items-form-sections-extra.tsx` can render the same SectionCard /
 * Field / BoolToggle wrapper without duplicating markup.
 */

import * as React from 'react';

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-[var(--st-danger)]">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function BoolToggle({
  label,
  checked,
  onChange,
  name,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  name: string;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2 rounded border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[12.5px]">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(Boolean(c))}
      />
      <span>{label}</span>
      <input type="hidden" name={name} value={checked ? 'on' : ''} />
    </label>
  );
}
