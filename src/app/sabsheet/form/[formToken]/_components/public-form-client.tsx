'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { submitForm } from '@/app/actions/sabsheet-forms-public.actions';
import type { SabsheetForm, SabsheetFormField } from '@/lib/sabsheet/forms/types';

type PublicForm = Pick<
  SabsheetForm,
  'token' | 'title' | 'description' | 'fields' | 'status'
>;

interface Props {
  form: PublicForm;
}

const inputTypeFor = (type: SabsheetFormField['type']): string => {
  switch (type) {
    case 'email':
      return 'email';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
};

/**
 * Renders a public SabSheet form and submits through the unauthenticated
 * `submitForm` server action, which appends a row to the underlying sheet.
 */
export function PublicFormClient({ form }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [hp, setHp] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (columnIndex: number, value: string) =>
    setValues((prev) => ({ ...prev, [String(columnIndex)]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitForm(form.token, { ...values, _hp: hp });
      if ('error' in res) {
        setError(res.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="20ui min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md" padding="lg">
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="Thanks!"
            description="Your response has been recorded."
          />
        </Card>
      </div>
    );
  }

  if (form.status === 'closed') {
    return (
      <div className="20ui min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md" padding="lg">
          <EmptyState
            title="Form closed"
            description="This form is no longer accepting responses."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="20ui min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl" padding="lg">
        <PageHeader bordered={false} compact>
          <PageHeaderHeading>
            <PageTitle>{form.title}</PageTitle>
            {form.description ? (
              <PageDescription>{form.description}</PageDescription>
            ) : null}
          </PageHeaderHeading>
        </PageHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {form.fields.map((f) => (
            <Field key={f.columnIndex} label={f.label} required={f.required}>
              {f.type === 'select' ? (
                <select
                  className="block w-full rounded-md border px-3 py-2 text-sm"
                  value={values[String(f.columnIndex)] ?? ''}
                  onChange={(e) => setValue(f.columnIndex, e.target.value)}
                  required={f.required}
                >
                  <option value="">Select…</option>
                  {(f.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={inputTypeFor(f.type)}
                  value={values[String(f.columnIndex)] ?? ''}
                  onChange={(e) => setValue(f.columnIndex, e.target.value)}
                  required={f.required}
                />
              )}
            </Field>
          ))}

          {/* Honeypot — hidden from humans, tempting to bots. */}
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
          />

          {error ? (
            <Alert tone="danger" title="Submission failed">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? 'Submitting' : 'Submit'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
