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
import { LuBookOpen, LuChevronDown, LuChevronRight, LuCircleCheck } from 'react-icons/lu';
import { getNodeDoc } from '@/lib/sabflow/docs/nodeDocs';

type Props = { blockType: string };

export function BlockDocsSection({ blockType }: Props) {
  const doc = getNodeDoc(blockType);
  const [open, setOpen] = useState(false);

  if (!doc) return null;

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-[var(--gray-10)]">
          <LuBookOpen className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1">
          <span className="block text-[12px] font-semibold text-[var(--gray-12)]">About this step</span>
          <span className="block text-[10.5px] text-[var(--gray-9)] line-clamp-2">
            {doc.summary}
          </span>
        </span>
        <span className="text-[var(--gray-8)]">
          {open ? (
            <LuChevronDown className="h-3.5 w-3.5" />
          ) : (
            <LuChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--gray-5)] p-3 space-y-3">
          {doc.whatItDoes && (
            <DocBlock title="What it does" body={doc.whatItDoes} />
          )}

          {doc.fields && doc.fields.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
                Fields
              </p>
              <ul className="mt-1 space-y-1.5">
                {doc.fields.map((f) => (
                  <li key={f.name} className="text-[11.5px] leading-snug text-[var(--gray-11)]">
                    <span className="font-semibold text-[var(--gray-12)]">{f.name}</span>
                    {f.required ? <span className="ml-1 text-[var(--st-text)]">*</span> : null}
                    {f.defaultValue ? (
                      <span className="ml-1 rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-10)]">
                        default: {f.defaultValue}
                      </span>
                    ) : null}
                    <span className="block text-[var(--gray-9)]">{f.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.outputs && doc.outputs.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
                Available variables
              </p>
              <ul className="mt-1 space-y-1">
                {doc.outputs.map((o) => (
                  <li key={o.token} className="flex items-start gap-1.5 text-[11.5px]">
                    <code className="shrink-0 rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--st-text)]">
                      {o.token}
                    </code>
                    <span className="text-[var(--gray-10)]">{o.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.examples && doc.examples.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
                Examples
              </p>
              <ul className="mt-1 space-y-1">
                {doc.examples.map((ex) => (
                  <li
                    key={ex}
                    className="flex items-start gap-1.5 text-[11.5px] text-[var(--gray-11)]"
                  >
                    <LuCircleCheck className="mt-[1px] h-3 w-3 shrink-0 text-[var(--st-text)]" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.notes && doc.notes.length > 0 && (
            <div className="rounded-md border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] p-2 text-[11.5px] text-[var(--gray-10)] space-y-1">
              {doc.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--gray-11)]">{body}</p>
    </div>
  );
}
