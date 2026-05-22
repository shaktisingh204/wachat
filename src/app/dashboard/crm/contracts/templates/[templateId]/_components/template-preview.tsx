'use client';

import * as React from 'react';

import { Input, Label } from '@/components/zoruui';

interface TemplatePreviewProps {
  body: string;
  variables: string[];
}

const SAMPLE_DEFAULTS: Record<string, string> = {
  client_name: 'Acme Corp',
  company_name: 'Your Company Pvt Ltd',
  contract_number: 'CTR-2026-0042',
  start_date: new Date().toLocaleDateString(),
  end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  value: '50,000',
  currency: 'INR',
  signer_name: 'Jane Doe',
  signer_email: 'jane@acme.example',
};

function applySample(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = values[key];
    return v ?? `{{${key}}}`;
  });
}

export function TemplatePreview({ body, variables }: TemplatePreviewProps) {
  const initial = React.useMemo(() => {
    const seed: Record<string, string> = {};
    for (const key of variables) {
      seed[key] = SAMPLE_DEFAULTS[key] ?? '';
    }
    return seed;
  }, [variables]);

  const [values, setValues] = React.useState<Record<string, string>>(initial);

  React.useEffect(() => {
    setValues(initial);
  }, [initial]);

  const rendered = React.useMemo(
    () => applySample(body, values),
    [body, values],
  );

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
          Sample values
        </p>
        {variables.length === 0 ? (
          <p className="text-[12.5px] text-zoru-ink-muted">
            No variables detected.
          </p>
        ) : (
          variables.map((v) => (
            <div key={v}>
              <ZoruLabel
                htmlFor={`preview-${v}`}
                className="text-[11.5px] text-zoru-ink-muted"
              >
                {v}
              </ZoruLabel>
              <ZoruInput
                id={`preview-${v}`}
                value={values[v] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
                className="mt-1 h-8 text-[12.5px]"
              />
            </div>
          ))
        )}
      </div>
      <div className="rounded-md border border-zoru-line bg-zoru-surface p-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-zoru-ink">
          {rendered || (
            <span className="text-zoru-ink-muted">Empty template.</span>
          )}
        </pre>
      </div>
    </div>
  );
}
