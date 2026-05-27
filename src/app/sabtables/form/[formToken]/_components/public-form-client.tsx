'use client';

import { useState } from 'react';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
import type { SabtablesTableDoc } from '@/lib/rust-client/sabtables-tables';
import type { SabtablesViewDoc } from '@/lib/rust-client/sabtables-views';

interface Props {
  view: SabtablesViewDoc;
  table: SabtablesTableDoc;
}

/**
 * Renders a public form for a SabTables `form` view. Submits through a
 * Next.js API route (`/api/sabtables/forms/[formToken]`) that the
 * server-side wiring will need to provide — see TODO at the bottom of
 * `src/app/actions/sabtables.actions.ts`.
 */
export function PublicFormClient({ view, table }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabtables/forms/${encodeURIComponent(view.formToken ?? '')}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fieldsJson: values }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="zoruui min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Thanks!</h1>
          <p className="text-muted-foreground">Your response has been recorded.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="zoruui min-h-screen flex items-center justify-center p-6">
      <Card className="p-8 w-full max-w-xl">
        <h1 className="text-2xl font-semibold">{view.name || table.name}</h1>
        <p className="text-sm text-muted-foreground mb-6">{table.description}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {table.fields.map((f) => (
            <div key={f.id}>
              <Label htmlFor={`fld-${f.id}`}>
                {f.name}
                {f.isRequired ? <span className="text-destructive ml-1">*</span> : null}
              </Label>
              {f.fieldType === 'long_text' ? (
                <Textarea
                  id={`fld-${f.id}`}
                  value={(values[f.id] as string | undefined) ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  required={f.isRequired}
                  rows={4}
                />
              ) : f.fieldType === 'checkbox' ? (
                <input
                  id={`fld-${f.id}`}
                  type="checkbox"
                  checked={Boolean(values[f.id])}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.checked }))
                  }
                />
              ) : (
                <Input
                  id={`fld-${f.id}`}
                  type={
                    f.fieldType === 'email'
                      ? 'email'
                      : f.fieldType === 'url'
                        ? 'url'
                        : f.fieldType === 'number' ||
                            f.fieldType === 'currency' ||
                            f.fieldType === 'percent' ||
                            f.fieldType === 'rating'
                          ? 'number'
                          : f.fieldType === 'date'
                            ? 'date'
                            : f.fieldType === 'datetime'
                              ? 'datetime-local'
                              : 'text'
                  }
                  value={(values[f.id] as string | number | undefined) ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  required={f.isRequired}
                />
              )}
            </div>
          ))}
          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
