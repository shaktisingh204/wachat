'use client';

/**
 * SabBigin — web forms list (client).
 *
 * Renders the tenant's `crm_forms` with copy-to-clipboard helpers for the
 * hosted lead-form link (`/p/lead-form/[id]`) and the iframe embed snippet
 * (`/embed/crm-form/[id]`). Copy actions resolve the absolute origin at runtime
 * so the snippet is paste-ready.
 */

import * as React from 'react';
import { Check, Code2, Copy, ExternalLink, FileText } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  toast,
} from '@/components/sabcrm/20ui';

export interface FormLite {
  id: string;
  name: string;
  submissionCount: number;
}

export interface FormsListProps {
  forms: FormLite[];
}

export function FormsList({ forms }: FormsListProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  function origin(): string {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }

  async function copy(text: string, key: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      toast.success({ title: `${label} copied` });
      window.setTimeout(() => setCopiedId((c) => (c === key ? null : c)), 1800);
    } catch {
      toast.error({ title: 'Could not copy', description: 'Copy manually instead.' });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {forms.map((form) => {
        const publicUrl = `${origin()}/p/lead-form/${form.id}`;
        const embedUrl = `${origin()}/embed/crm-form/${form.id}`;
        const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" title="${form.name}"></iframe>`;
        const linkKey = `${form.id}:link`;
        const embedKey = `${form.id}:embed`;

        return (
          <Card key={form.id} padding="none">
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-[var(--st-accent)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-[var(--st-text)]">
                    {form.name}
                  </span>
                </div>
                <Badge tone="neutral" kind="soft">
                  {form.submissionCount} submission
                  {form.submissionCount === 1 ? '' : 's'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="u-btn u-btn--outline u-btn--sm"
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="u-btn__label">Open form</span>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={copiedId === linkKey ? Check : Copy}
                  onClick={() => copy(publicUrl, linkKey, 'Link')}
                >
                  {copiedId === linkKey ? 'Copied' : 'Copy link'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={copiedId === embedKey ? Check : Code2}
                  onClick={() => copy(embedSnippet, embedKey, 'Embed snippet')}
                >
                  {copiedId === embedKey ? 'Copied' : 'Copy embed'}
                </Button>
              </div>

              <code className="block overflow-x-auto whitespace-pre rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                {embedSnippet}
              </code>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
