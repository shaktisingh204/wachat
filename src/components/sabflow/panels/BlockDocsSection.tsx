'use client';
/**
 * BlockDocsSection
 *
 * Renders the in-product documentation surface ("About this step") at the
 * bottom of `BlockSettingsPanel`. Reads from the shared `nodeDocs` registry
 * so every block gets a doc card without panel-specific wiring.
 *
 * Collapsed by default to keep the settings panel focused on configuration.
 */

import { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/sabcrm/20ui';
import { getNodeDoc } from '@/lib/sabflow/docs/nodeDocs';

type Props = { blockType: string };

export function BlockDocsSection({ blockType }: Props) {
  const doc = getNodeDoc(blockType);
  const [open, setOpen] = useState(false);

  if (!doc) return null;

  return (
    <Card variant="outlined" padding="none" className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          hideChevron
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <BookOpen
            className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]"
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0">
            <span className="block text-[12px] font-semibold text-[var(--st-text)]">
              About this step
            </span>
            <span className="block text-[10.5px] text-[var(--st-text-tertiary)] line-clamp-2">
              {doc.summary}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-[var(--st-border)] p-3 space-y-3">
            {doc.whatItDoes && <DocBlock title="What it does" body={doc.whatItDoes} />}

            {doc.fields && doc.fields.length > 0 && (
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Fields
                </p>
                <ul className="mt-1 space-y-1.5">
                  {doc.fields.map((f) => (
                    <li
                      key={f.name}
                      className="text-[11.5px] leading-snug text-[var(--st-text-secondary)]"
                    >
                      <span className="font-semibold text-[var(--st-text)]">{f.name}</span>
                      {f.required ? (
                        <span className="ml-1 text-[var(--st-danger)]">*</span>
                      ) : null}
                      {f.defaultValue ? (
                        <span className="ml-1 rounded bg-[var(--st-bg-muted)] px-1 font-mono text-[10.5px] text-[var(--st-text-secondary)]">
                          default: {f.defaultValue}
                        </span>
                      ) : null}
                      <span className="block text-[var(--st-text-tertiary)]">{f.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doc.outputs && doc.outputs.length > 0 && (
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Available variables
                </p>
                <ul className="mt-1 space-y-1">
                  {doc.outputs.map((o) => (
                    <li key={o.token} className="flex items-start gap-1.5 text-[11.5px]">
                      <code className="shrink-0 rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--st-accent)]">
                        {o.token}
                      </code>
                      <span className="text-[var(--st-text-secondary)]">{o.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doc.examples && doc.examples.length > 0 && (
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Examples
                </p>
                <ul className="mt-1 space-y-1">
                  {doc.examples.map((ex) => (
                    <li
                      key={ex}
                      className="flex items-start gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]"
                    >
                      <CheckCircle2
                        className="mt-[1px] h-3 w-3 shrink-0 text-[var(--st-status-ok)]"
                        aria-hidden="true"
                      />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doc.notes && doc.notes.length > 0 && (
              <div className="rounded-md border border-dashed border-[var(--st-border-strong)] bg-[var(--st-bg-secondary)] p-2 text-[11.5px] text-[var(--st-text-secondary)] space-y-1">
                {doc.notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function DocBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--st-text-secondary)]">{body}</p>
    </div>
  );
}
