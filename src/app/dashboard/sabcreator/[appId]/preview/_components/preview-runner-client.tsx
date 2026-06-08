'use client';

/**
 * Runtime preview for SabCreator apps. Renders forms (with live submit)
 * and a stub renderer for pages. Real page widgets (charts, list views)
 * will be implemented in a follow-up. This preview surface is enough
 * to validate form schemas plus workflow wiring end-to-end.
 */

import { useState, useTransition } from 'react';
import { FileText, LayoutDashboard } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Textarea,
} from '@/components/sabcrm/20ui';
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
      <SegmentedControl
        aria-label="Preview surface"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'forms', label: `Forms (${forms.length})`, icon: FileText },
          { value: 'pages', label: `Pages (${pages.length})`, icon: LayoutDashboard },
        ]}
      />
      {tab === 'forms' ? (
        forms.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No forms to preview"
            description="Build a form in the designer to validate its schema here."
          />
        ) : (
          <div className="space-y-4">
            {forms.map((f) => (
              <FormRuntime key={f._id} form={f} />
            ))}
          </div>
        )
      ) : pages.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No pages to preview"
          description="Create a page in the designer to inspect its config tree here."
        />
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
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{form.name}</CardTitle>
          <CardDescription>On submit: {form.submitAction}</CardDescription>
        </div>
        <Badge tone="neutral" kind="outline">
          {form.status}
        </Badge>
      </CardHeader>
      <CardBody>
        {fields.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">No fields defined.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {fields
              .filter((f) => !f.hidden)
              .map((f) => (
                <Field
                  key={f.tableFieldId}
                  label={f.label}
                  required={!!f.required}
                  help={f.helpText || undefined}
                >
                  <Input
                    required={!!f.required}
                    value={String(values[f.tableFieldId] ?? '')}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [f.tableFieldId]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            <Button type="submit" variant="primary" loading={pending}>
              {pending ? 'Submitting' : 'Submit'}
            </Button>
            {result ? (
              <Field label="Result">
                <Textarea readOnly value={result} rows={6} className="font-mono text-xs" />
              </Field>
            ) : null}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function PageStub({ page }: { page: SabcreatorPageDoc }) {
  const widgets = (page.configJson as { widgets?: unknown })?.widgets ?? [];
  const count = Array.isArray(widgets) ? widgets.length : 0;

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{page.name}</CardTitle>
          <CardDescription>
            {page.kind} · /{page.slug} · visibility {page.roleVisibility}
          </CardDescription>
        </div>
        <Badge tone="neutral" kind="outline" className="tabular-nums">
          {count} widgets
        </Badge>
      </CardHeader>
      <CardBody>
        <p className="text-xs text-[var(--st-text-secondary)]">
          Widget rendering is stubbed in preview. Use the page designer to inspect the
          config tree.
        </p>
      </CardBody>
    </Card>
  );
}
