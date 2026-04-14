'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';
import { LoaderCircle, Send } from 'lucide-react';
import { submitPublicTicket } from '@/app/actions/worksuite/public.actions';

interface Field {
  _id: string;
  field_name: string;
  field_type: string;
  field_values?: string;
  is_required?: boolean;
}

const BASE_FIELDS: Field[] = [
  { _id: 'name', field_name: 'name', field_type: 'text', is_required: true },
  { _id: 'email', field_name: 'email', field_type: 'email', is_required: true },
  { _id: 'subject', field_name: 'subject', field_type: 'text', is_required: true },
  {
    _id: 'description',
    field_name: 'description',
    field_type: 'textarea',
    is_required: true,
  },
];

export function TicketFormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: Field[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFields = [
    ...BASE_FIELDS,
    ...fields.filter(
      (f) => !BASE_FIELDS.some((b) => b.field_name === f.field_name),
    ),
  ];

  const setValue = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setError(null);
    for (const f of allFields) {
      if (f.is_required && !String(values[f.field_name] || '').trim()) {
        setError(`${f.field_name} is required`);
        return;
      }
    }
    setBusy(true);
    const res = await submitPublicTicket(formId, values);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=ticket');
  };

  return (
    <ClayCard>
      <div className="grid gap-3">
        {allFields.map((f) => (
          <FieldInput
            key={f._id}
            field={f}
            value={values[f.field_name] || ''}
            onChange={(v) => setValue(f.field_name, v)}
            disabled={busy}
          />
        ))}
      </div>
      {error ? (
        <p className="mt-3 text-[12.5px] text-clay-rose-ink">{error}</p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <ClayButton
          variant="obsidian"
          onClick={submit}
          disabled={busy}
          leading={
            busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )
          }
        >
          Submit ticket
        </ClayButton>
      </div>
    </ClayCard>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);
  const label = (
    <span className="text-[12.5px] text-clay-ink">
      {labelText}
      {field.is_required ? (
        <span className="text-clay-rose-ink"> *</span>
      ) : null}
    </span>
  );
  if (field.field_type === 'textarea') {
    return (
      <label className="flex flex-col gap-1">
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="clay-input min-h-[120px] py-2"
          rows={5}
        />
      </label>
    );
  }
  if (field.field_type === 'select' && field.field_values) {
    const opts = field.field_values
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    return (
      <label className="flex flex-col gap-1">
        {label}
        <ClaySelect
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={[
            { value: '', label: 'Select…' },
            ...opts.map((v) => ({ value: v, label: v })),
          ]}
        />
      </label>
    );
  }
  const inputType =
    field.field_type === 'date'
      ? 'date'
      : field.field_type === 'number'
        ? 'number'
        : field.field_type === 'email'
          ? 'email'
          : field.field_type === 'url'
            ? 'url'
            : 'text';
  return (
    <label className="flex flex-col gap-1">
      {label}
      <ClayInput
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function labelize(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
