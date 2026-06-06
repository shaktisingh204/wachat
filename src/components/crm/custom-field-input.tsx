'use client';

import { Input, Textarea, Label, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
/**
 * <CustomFieldInput> + <CustomFieldDisplay> — render a single
 * `WsCustomField` instance.
 *
 * Why centralise this:
 *  - Every entity edit form (deals, accounts, employees, tickets, …)
 *    that wants to support custom fields previously had to open-code
 *    the same `switch (field.type)`. The new `entity_ref` type would
 *    have meant patching every one of those sites.
 *  - With one component, adding a new custom-field type (the goal of
 *    `crm_function_plan.md` §13.8 — `entity_ref`) is a one-line
 *    change here and every form benefits at once.
 *
 * Storage contract (read by `applyCustomFieldsToEntity`):
 *  - `text` / `textarea` / `email` / `url` / `select` / `radio` / `date` → string
 *  - `number`                                                            → number
 *  - `checkbox` (single)                                                 → boolean
 *  - `entity_ref` (single)                                               → string id
 *  - `entity_ref` (multi=true)                                           → string[] of ids
 */

import * as React from 'react';

import { cn } from '@/lib/utils';
import { EntityPicker, EntityPickerChip } from '@/components/crm/entity-picker';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export type CustomFieldValue =
  | string
  | string[]
  | number
  | boolean
  | null
  | undefined;

export interface CustomFieldInputProps {
  field: WsCustomField & { _id?: string | unknown };
  /** Current value keyed by `field.name` (slug). */
  value: CustomFieldValue;
  /** Called with the new value — slug-keyed parent state owns persistence. */
  onChange: (next: CustomFieldValue) => void;
  disabled?: boolean;
  /** Render the field's `label` above the input. Defaults to true. */
  showLabel?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function asString(v: CustomFieldValue): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function entityRefValue(
  v: CustomFieldValue,
  multi: boolean,
): string | string[] | null {
  if (v == null || v === '') return null;
  if (multi) {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string') return [v];
    return null;
  }
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
  return typeof v === 'string' ? v : null;
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export function CustomFieldInput({
  field,
  value,
  onChange,
  disabled,
  showLabel = true,
  className,
}: CustomFieldInputProps) {
  const slug = field.name;
  const label = field.label;
  const required = Boolean(field.is_required);

  // The picker accepts `null`, `string`, or `string[]`. Other inputs
  // are happy with primitives. Branch on `field.type` and only emit
  // the labelled wrapper once — no duplicate `<Label>` per case.
  let control: React.ReactNode;

  switch (field.type) {
    case 'textarea': {
      control = (
        <Textarea
          id={slug}
          name={slug}
          required={required}
          disabled={disabled}
          rows={3}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }

    case 'select':
    case 'radio': {
      // `radio` shares the same shape on disk (single string). For now
      // we render both as a Select — the visual difference can be
      // upgraded later without changing storage.
      const options = field.values ?? [];
      control = (
        <Select
          name={slug}
          value={asString(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={slug}>
            <SelectValue placeholder={`Select ${label}…`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }

    case 'checkbox': {
      // A single boolean checkbox. (Multi-checkbox lists could later
      // map to a `string[]` value; the storage contract already
      // permits arrays, but the UI for that would land alongside.)
      control = (
        <div className="flex items-center gap-2">
          <Checkbox
            id={slug}
            name={slug}
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(v) => onChange(Boolean(v))}
          />
          {showLabel ? (
            <Label htmlFor={slug} className="text-[13px]">
              {label}
              {required ? <span className="ml-0.5 text-[var(--st-text)]">*</span> : null}
            </Label>
          ) : null}
        </div>
      );
      // Checkbox renders its own inline label, so skip the outer one.
      return (
        <div className={cn('flex flex-col gap-1', className)}>{control}</div>
      );
    }

    case 'number': {
      control = (
        <Input
          id={slug}
          name={slug}
          type="number"
          required={required}
          disabled={disabled}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : null);
          }}
        />
      );
      break;
    }

    case 'date': {
      control = (
        <Input
          id={slug}
          name={slug}
          type="date"
          required={required}
          disabled={disabled}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }

    case 'email': {
      control = (
        <Input
          id={slug}
          name={slug}
          type="email"
          required={required}
          disabled={disabled}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }

    case 'url': {
      control = (
        <Input
          id={slug}
          name={slug}
          type="url"
          required={required}
          disabled={disabled}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }

    case 'entity_ref': {
      // The whole point of §13.8 — a custom field referencing any
      // registered entity automatically gets the unified picker.
      if (!field.targetEntity) {
        // Misconfigured field. Render nothing rather than crashing
        // the whole form.
        return null;
      }
      control = (
        <EntityPicker
          entity={field.targetEntity}
          multi={Boolean(field.multi)}
          required={required}
          disabled={disabled}
          value={entityRefValue(value, Boolean(field.multi))}
          onChange={(next) => {
            // The picker hands us `string | string[] | null` already
            // shaped for our storage contract.
            onChange(next as CustomFieldValue);
          }}
          placeholder={`Search ${label}…`}
        />
      );
      break;
    }

    case 'text':
    default: {
      control = (
        <Input
          id={slug}
          name={slug}
          required={required}
          disabled={disabled}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {showLabel ? (
        <Label htmlFor={slug} className="text-[13px]">
          {label}
          {required ? <span className="ml-0.5 text-[var(--st-text)]">*</span> : null}
        </Label>
      ) : null}
      {control}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only display                                                   */
/* ------------------------------------------------------------------ */

export interface CustomFieldDisplayProps {
  field: WsCustomField & { _id?: string | unknown };
  value: CustomFieldValue;
  /** Hide the label — useful in table cells. */
  bare?: boolean;
  className?: string;
}

/**
 * Read-only renderer for a custom-field value. Detail pages and
 * table cells should use this instead of open-coding the formatting.
 */
export function CustomFieldDisplay({
  field,
  value,
  bare,
  className,
}: CustomFieldDisplayProps) {
  let body: React.ReactNode;

  if (value == null || value === '') {
    body = <span className="text-[var(--st-text-secondary)]">—</span>;
  } else if (field.type === 'entity_ref') {
    if (!field.targetEntity) {
      body = <span className="text-[var(--st-text-secondary)]">—</span>;
    } else if (field.multi) {
      const ids = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : typeof value === 'string'
          ? [value]
          : [];
      body = ids.length === 0 ? (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <EntityPickerChip
              key={id}
              entity={field.targetEntity!}
              id={id}
            />
          ))}
        </div>
      );
    } else {
      const id = Array.isArray(value)
        ? typeof value[0] === 'string'
          ? value[0]
          : null
        : typeof value === 'string'
          ? value
          : null;
      body = (
        <EntityPickerChip entity={field.targetEntity} id={id} />
      );
    }
  } else if (field.type === 'checkbox') {
    body = (
      <span className="text-[13px]">{value ? 'Yes' : 'No'}</span>
    );
  } else if (field.type === 'url' && typeof value === 'string') {
    body = (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] text-[var(--st-text)] underline-offset-2 hover:underline"
      >
        {value}
      </a>
    );
  } else if (field.type === 'email' && typeof value === 'string') {
    body = (
      <a
        href={`mailto:${value}`}
        className="text-[13px] text-[var(--st-text)] underline-offset-2 hover:underline"
      >
        {value}
      </a>
    );
  } else {
    body = <span className="text-[13px]">{asString(value)}</span>;
  }

  if (bare) {
    return <div className={className}>{body}</div>;
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
        {field.label}
      </span>
      {body}
    </div>
  );
}

export default CustomFieldInput;
