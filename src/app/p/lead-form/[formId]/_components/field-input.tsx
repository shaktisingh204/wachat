import { Input, Label, Select } from '@/components/sabcrm/20ui';
import type { LeadFormField } from '../types';

export function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: LeadFormField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);
  const label = (
    <Label htmlFor={field._id} className="text-[12px] font-mono uppercase tracking-tight text-[var(--st-text-secondary)]">
      {labelText}
      {field.is_required ? (
        <span className="text-danger"> *</span>
      ) : null}
    </Label>
  );

  if (field.field_type === 'textarea') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <textarea
          id={field._id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex min-h-[100px] w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px] font-mono shadow-inner ring-offset-zoru-surface placeholder:text-[var(--st-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={4}
        />
      </div>
    );
  }

  if (field.field_type === 'select' && field.field_values?.length) {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Select
          id={field._id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={[
            { value: '', label: 'Select option...' },
            ...field.field_values.map((v) => ({ value: v, label: v })),
          ]}
          className="font-mono text-[12.5px]"
        />
      </div>
    );
  }

  const inputType =
    field.field_type === 'date'
      ? 'date'
      : field.field_type === 'number'
        ? 'number'
        : field.field_name === 'email'
          ? 'email'
          : 'text';

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        id={field._id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono text-[12.5px]"
      />
    </div>
  );
}

function labelize(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
