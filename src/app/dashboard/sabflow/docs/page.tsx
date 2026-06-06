/**
 * SabFlow Docs — browsable catalog of every trigger and block.
 *
 * Sources its content from `@/lib/sabflow/docs/nodeDocs` so this page stays
 * in sync with the in-panel "About this step" / "About this trigger" docs.
 *
 * Layout: left rail with section navigation, main pane lists nodes per
 * section. Each card shows summary + when-it-fires/what-it-does + a
 * collapsible field list, output tokens, examples, and sample payload.
 */
'use client';

import { useMemo, useState } from 'react';
import {
  LuBookOpen,
  LuChevronDown,
  LuChevronRight,
  LuCircleCheck,
  LuSearch,
} from 'react-icons/lu';
import { NODE_DOCS, NODE_DOC_SECTIONS, type NodeDoc } from '@/lib/sabflow/docs/nodeDocs';
import { getSamplePayload } from '@/lib/sabflow/docs/samplePayloads';
import { getTriggerFilters } from '@/lib/sabflow/docs/triggerFilters';
import { cn } from '@/lib/utils';

type DocRow = { key: string; doc: NodeDoc };

export default function SabFlowDocsPage() {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<NodeDoc['section'] | 'all'>('all');

  const rows: DocRow[] = useMemo(
    () =>
      Object.entries(NODE_DOCS)
        .map(([key, doc]) => ({ key, doc }))
        .sort((a, b) => a.doc.label.localeCompare(b.doc.label)),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeSection !== 'all' && row.doc.section !== activeSection) return false;
      if (!q) return true;
      const haystack = `${row.doc.label} ${row.doc.summary} ${row.key}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, activeSection]);

  const counts = useMemo(() => {
    const map = new Map<NodeDoc['section'], number>();
    for (const row of rows) {
      map.set(row.doc.section, (map.get(row.doc.section) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  return (
    <div className="flex h-full min-h-screen bg-[var(--gray-1)]">
      {/* ── Left rail ──────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-[var(--gray-5)] bg-[var(--gray-2)] p-4 overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-text)]/10 text-[var(--st-text)]">
            <LuBookOpen className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-[14px] font-semibold text-[var(--gray-12)]">SabFlow Docs</h1>
            <p className="text-[11px] text-[var(--gray-9)]">{rows.length} nodes</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('all')}
          className={cn(
            'mb-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
            activeSection === 'all'
              ? 'bg-[var(--st-text)]/10 text-[var(--st-text)]'
              : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          All nodes
          <span className="float-right text-[10.5px] text-[var(--gray-8)]">{rows.length}</span>
        </button>

        {NODE_DOC_SECTIONS.map((section) => {
          const count = counts.get(section.id) ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                activeSection === section.id
                  ? 'bg-[var(--st-text)]/10 text-[var(--st-text)]'
                  : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
              )}
            >
              {section.label}
              <span className="float-right text-[10.5px] text-[var(--gray-8)]">{count}</span>
            </button>
          );
        })}
      </aside>

      {/* ── Main pane ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-[var(--gray-5)] bg-[var(--gray-1)]/80 px-6 py-4 backdrop-blur">
          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gray-8)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes — try 'whatsapp', 'condition', 'deal'…"
              className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] py-2 pl-10 pr-3 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)]"
            />
          </div>
        </div>

        <div className="px-6 py-6 space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] p-8 text-center text-[13px] text-[var(--gray-9)]">
              No nodes match &ldquo;{query}&rdquo;.
            </div>
          )}
          {filtered.map((row) => (
            <DocCard key={row.key} docKey={row.key} doc={row.doc} />
          ))}
        </div>
      </main>
    </div>
  );
}

function DocCard({ docKey, doc }: { docKey: string; doc: NodeDoc }) {
  const [open, setOpen] = useState(false);
  const samplePayload = getSamplePayload(docKey);
  const filters = getTriggerFilters(docKey);
  const isTrigger = doc.section.startsWith('trigger');

  const sampleJson = useMemo(
    () => (samplePayload !== undefined ? JSON.stringify(samplePayload, null, 2) : null),
    [samplePayload],
  );

  return (
    <article className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 text-[var(--gray-9)]">
          {open ? (
            <LuChevronDown className="h-4 w-4" />
          ) : (
            <LuChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--gray-12)]">{doc.label}</h2>
            <code className="rounded bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--gray-10)]">
              {docKey}
            </code>
            <span className="rounded-full bg-[var(--st-text)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
              {isTrigger ? 'Trigger' : 'Block'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--gray-10)]">{doc.summary}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--gray-5)] px-4 py-4 space-y-4">
          {(doc.whenItFires || doc.whatItDoes) && (
            <Block title={doc.whenItFires ? 'When it fires' : 'What it does'}>
              <p className="text-[13px] leading-relaxed text-[var(--gray-11)]">
                {doc.whenItFires ?? doc.whatItDoes}
              </p>
            </Block>
          )}

          {doc.fields && doc.fields.length > 0 && (
            <Block title="Fields">
              <ul className="space-y-2">
                {doc.fields.map((f) => (
                  <li key={f.name} className="text-[12.5px] leading-snug text-[var(--gray-11)]">
                    <span className="font-semibold text-[var(--gray-12)]">{f.name}</span>
                    {f.required ? <span className="ml-1 text-[var(--st-text)]">*</span> : null}
                    {f.defaultValue ? (
                      <span className="ml-2 rounded bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gray-10)]">
                        default: {f.defaultValue}
                      </span>
                    ) : null}
                    <span className="block text-[var(--gray-9)]">{f.description}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {filters.length > 0 && (
            <Block title="Available filters">
              <ul className="space-y-1.5">
                {filters.map((f) => (
                  <li key={f.path} className="flex items-start gap-2 text-[12.5px]">
                    <code className="shrink-0 rounded bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-text)]">
                      {f.path}
                    </code>
                    <span className="text-[var(--gray-10)]">
                      {f.hint ?? `${f.label} (${f.kind})`}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {doc.outputs && doc.outputs.length > 0 && (
            <Block title="Available variables">
              <ul className="space-y-1.5">
                {doc.outputs.map((o) => (
                  <li key={o.token} className="flex items-start gap-2 text-[12.5px]">
                    <code className="shrink-0 rounded bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-text)]">
                      {o.token}
                    </code>
                    <span className="text-[var(--gray-10)]">{o.description}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {doc.examples && doc.examples.length > 0 && (
            <Block title="Examples">
              <ul className="space-y-1.5">
                {doc.examples.map((ex) => (
                  <li
                    key={ex}
                    className="flex items-start gap-2 text-[12.5px] text-[var(--gray-11)]"
                  >
                    <LuCircleCheck className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--st-text)]" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {sampleJson && (
            <Block title="Sample payload">
              <pre className="max-h-72 overflow-auto rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--gray-11)]">
                {sampleJson}
              </pre>
            </Block>
          )}

          {doc.notes && doc.notes.length > 0 && (
            <div className="rounded-md border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] p-3 text-[12px] leading-relaxed text-[var(--gray-10)] space-y-1">
              {doc.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {title}
      </h3>
      {children}
    </section>
  );
}
