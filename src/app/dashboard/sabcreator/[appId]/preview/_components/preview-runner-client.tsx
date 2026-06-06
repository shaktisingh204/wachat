'use client';

/**
 * Runtime preview for SabCreator apps. Renders forms (with live submit)
 * and a stub renderer for pages. Real page widgets (charts, list views)
 * will be implemented in a follow-up — this preview surface is enough
 * to validate form schemas + workflow wiring end-to-end.
 */

import { useState, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import { submitSabcreatorForm } from '@/app/actions/sabcreator.actions';
import type {
  SabcreatorFormDoc,
  SabcreatorFormFieldSpec,
} from '@/lib/rust-client/sabcreator-forms';
import type { SabcreatorPageDoc } from '@/lib/rust-client/sabcreator-pages';

interface Props {
  forms: SabcreatorFormDoc[];
  pages: SabcreatorPageDoc[];
}

export function PreviewRunnerClient({ forms, pages }: Props) {
  const [tab, setTab] = useState<'forms' | 'pages'>(
    forms.length > 0 ? 'forms' : 'pages',
  );
  return (
    <div className="space-y-4">
      <div className="inline-flex border rounded-md p-1 bg-[var(--st-bg-muted)]/30">
        <button
          type="button"
          onClick={() => setTab('forms')}
          className={`px-3 py-1.5 text-sm rounded ${
            tab === 'forms' ? 'bg-[var(--st-bg-secondary)] shadow-sm' : 'text-[var(--st-text-secondary)]'
          }`}
        >
          Forms ({forms.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('pages')}
          className={`px-3 py-1.5 text-sm rounded ${
            tab === 'pages' ? 'bg-[var(--st-bg-secondary)] shadow-sm' : 'text-[var(--st-text-secondary)]'
          }`}
        >
          Pages ({pages.length})
        </button>
      </div>
      {tab === 'forms' ? (
        <div className="space-y-4">
          {forms.map((f) => (
            <FormRuntime key={f._id} form={f} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map((p) => (
            <PageStub key={p._id} page={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormRuntime({ form }: { form: SabcreatorFormDoc }) {
  const fields: SabcreatorFormFieldSpec[] = Array.isArray(form.fieldsJson)
    ? (form.fieldsJson as SabcreatorFormFieldSpec[])
    : [];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await submitSabcreatorForm(form._id, values);
        setResult(JSON.stringify(res, null, 2));
      } catch (err) {
        setResult(`Error: ${(err as Error).message}`);
      }
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold">{form.name}</div>
          <div className="text-xs text-[var(--st-text-secondary)]">
            on submit: {form.submitAction}
          </div>
        </div>
        <Badge variant="outline">{form.status}</Badge>
      </div>
      {fields.length === 0 ? (
        <div className="text-sm text-[var(--st-text-secondary)]">No fields defined.</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields
            .filter((f) => !f.hidden)
            .map((f) => (
              <div key={f.tableFieldId} className="space-y-1">
                <Label>
                  {f.label}
                  {f.required ? <span className="text-[var(--st-text)]"> *</span> : null}
                </Label>
                <Input
                  required={!!f.required}
                  value={String(values[f.tableFieldId] ?? '')}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, [f.tableFieldId]: e.target.value }))
                  }
                />
                {f.helpText ? (
                  <p className="text-xs text-[var(--st-text-secondary)]">{f.helpText}</p>
                ) : null}
              </div>
            ))}
          <Button type="submit" disabled={pending}>
            {pending ? 'Submitting…' : 'Submit'}
          </Button>
          {result ? (
            <Textarea readOnly value={result} rows={6} className="font-mono text-xs" />
          ) : null}
        </form>
      )}
    </Card>
  );
}

function PageStub({ page }: { page: SabcreatorPageDoc }) {
  const widgets =
    (page.configJson as { widgets?: unknown })?.widgets ?? [];
  const count = Array.isArray(widgets) ? widgets.length : 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{page.name}</div>
          <div className="text-xs text-[var(--st-text-secondary)]">
            {page.kind} · /{page.slug} · visibility {page.roleVisibility}
          </div>
        </div>
        <Badge variant="outline">{count} widgets</Badge>
      </div>
      <p className="text-xs text-[var(--st-text-secondary)] mt-3">
        Widget rendering is stubbed in preview. Use the page designer to inspect the
        config tree.
      </p>
    </Card>
  );
}
