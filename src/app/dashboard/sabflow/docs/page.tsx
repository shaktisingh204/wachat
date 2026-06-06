/**
 * SabFlow Docs - browsable catalog of every trigger and block.
 *
 * Sources its content from `@/lib/sabflow/docs/nodeDocs` so this page stays
 * in sync with the in-panel "About this step" / "About this trigger" docs.
 *
 * Layout: left rail with section navigation, main pane lists nodes per
 * section. Each card shows summary + when-it-fires/what-it-does + a
 * collapsible field list, output tokens, examples, and sample payload.
 *
 * Pure 20ui: Button rail, Field+Input search, Card per node, Collapsible
 * disclosure (built-in motion + a11y), Badge for the trigger/block pill,
 * EmptyState for no-match. One accent, one radius, --st-* tokens only.
 */
'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  CircleCheck,
  Search,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
  Field,
  Input,
  cn,
} from '@/components/sabcrm/20ui';
import { NODE_DOCS, NODE_DOC_SECTIONS, type NodeDoc } from '@/lib/sabflow/docs/nodeDocs';
import { getSamplePayload } from '@/lib/sabflow/docs/samplePayloads';
import { getTriggerFilters } from '@/lib/sabflow/docs/triggerFilters';

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
    <div className="ui20 flex h-full min-h-screen bg-[var(--st-bg)]">
      {/* Left rail */}
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[14px] font-semibold text-[var(--st-text)]">SabFlow Docs</h1>
            <p className="text-[11px] text-[var(--st-text-tertiary)]">{rows.length} nodes</p>
          </div>
        </div>

        <Button
          variant={activeSection === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          block
          onClick={() => setActiveSection('all')}
          className={cn(
            'mb-1 justify-between',
            activeSection === 'all' && 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]',
          )}
        >
          <span>All nodes</span>
          <span className="text-[10.5px] text-[var(--st-text-tertiary)]">{rows.length}</span>
        </Button>

        {NODE_DOC_SECTIONS.map((section) => {
          const count = counts.get(section.id) ?? 0;
          if (count === 0) return null;
          const isActive = activeSection === section.id;
          return (
            <Button
              key={section.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              block
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'justify-between',
                isActive && 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]',
              )}
            >
              <span>{section.label}</span>
              <span className="text-[10.5px] text-[var(--st-text-tertiary)]">{count}</span>
            </Button>
          );
        })}
      </aside>

      {/* Main pane */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-[var(--st-border)] bg-[var(--st-bg)]/80 px-6 py-4 backdrop-blur">
          <Field label="Search nodes" className="!gap-0">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes - try 'whatsapp', 'condition', 'deal'"
              iconLeft={Search}
              aria-label="Search nodes"
            />
          </Field>
        </div>

        <div className="space-y-3 px-6 py-6">
          {filtered.length === 0 && (
            <EmptyState
              icon={Search}
              title="No nodes match your search"
              description={query ? `Nothing matched "${query}". Try a broader term.` : 'Try a different term.'}
            />
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
  const samplePayload = getSamplePayload(docKey);
  const filters = getTriggerFilters(docKey);
  const isTrigger = doc.section.startsWith('trigger');

  const sampleJson = useMemo(
    () => (samplePayload !== undefined ? JSON.stringify(samplePayload, null, 2) : null),
    [samplePayload],
  );

  return (
    <Card padding="none" className="overflow-hidden">
      <Collapsible>
        <CollapsibleTrigger className="w-full px-4 py-3 text-left" hideChevron>
          <div className="flex w-full items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-[var(--st-text)]">{doc.label}</h2>
                <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--st-text-secondary)]">
                  {docKey}
                </code>
                <Badge tone={isTrigger ? 'accent' : 'neutral'} kind="soft">
                  {isTrigger ? 'Trigger' : 'Block'}
                </Badge>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                {doc.summary}
              </p>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-[var(--st-border)] px-4 py-4">
            {(doc.whenItFires || doc.whatItDoes) && (
              <Block title={doc.whenItFires ? 'When it fires' : 'What it does'}>
                <p className="text-[13px] leading-relaxed text-[var(--st-text)]">
                  {doc.whenItFires ?? doc.whatItDoes}
                </p>
              </Block>
            )}

            {doc.fields && doc.fields.length > 0 && (
              <Block title="Fields">
                <ul className="space-y-2">
                  {doc.fields.map((f) => (
                    <li key={f.name} className="text-[12.5px] leading-snug text-[var(--st-text)]">
                      <span className="font-semibold text-[var(--st-text)]">{f.name}</span>
                      {f.required ? (
                        <span className="ml-1 text-[var(--st-accent)]">*</span>
                      ) : null}
                      {f.defaultValue ? (
                        <span className="ml-2 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-text-secondary)]">
                          default: {f.defaultValue}
                        </span>
                      ) : null}
                      <span className="block text-[var(--st-text-tertiary)]">{f.description}</span>
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
                      <code className="shrink-0 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-accent)]">
                        {f.path}
                      </code>
                      <span className="text-[var(--st-text-secondary)]">
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
                      <code className="shrink-0 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--st-accent)]">
                        {o.token}
                      </code>
                      <span className="text-[var(--st-text-secondary)]">{o.description}</span>
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
                      className="flex items-start gap-2 text-[12.5px] text-[var(--st-text)]"
                    >
                      <CircleCheck
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--st-accent)]"
                        aria-hidden="true"
                      />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {sampleJson && (
              <Block title="Sample payload">
                <pre className="max-h-72 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--st-text)]">
                  {sampleJson}
                </pre>
              </Block>
            )}

            {doc.notes && doc.notes.length > 0 && (
              <div className="space-y-1 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border-strong)] bg-[var(--st-bg-secondary)] p-3 text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </h3>
      {children}
    </section>
  );
}
