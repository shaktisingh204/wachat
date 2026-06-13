'use client';

/**
 * SabCRM — List Builder (client).
 *
 * Type a request in plain language ("open enterprise deals over $10k"), pick the
 * object, and the LLM is turned into a VALIDATED filter spec that runs through
 * the same owner-scoped list path the dashboard uses. The page shows the exact
 * parsed filter (transparency — the model is never trusted blindly) and the
 * matching records, and lets the user save the spec as a re-runnable segment.
 *
 * Degrades honestly: with no AI provider configured the action returns the
 * shared "AI is not configured" error, surfaced inline. All UI is 20ui.
 */

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Play, Bookmark, Trash2, Filter as FilterIcon } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Alert,
  Badge,
  Skeleton,
  SelectField,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
// `ai-agentic` (pure, no `server-only`) is safe to import into a client bundle —
// we reuse its exact FilterSpec/FilterCondition shapes so the spec round-trips
// to `saveSegmentTw` without a structural-type mismatch.
import type { FilterSpec } from '@/lib/sabcrm/ai-agentic';
import type { FilterCondition } from '@/lib/sabcrm/records-filter';
import {
  nlBuildListTw,
  saveSegmentTw,
  listSegmentsTw,
  deleteSegmentTw,
} from '@/app/actions/sabcrm-agentic.actions';

/** Minimal object shape the page needs (slug + plural label). */
export interface ListBuilderObject {
  slug: string;
  labelPlural: string;
}

type SpecCondition = FilterCondition;
interface RunResult {
  spec: FilterSpec;
  object: string;
  records: Array<{ _id: string; object: string; label: string; data: Record<string, unknown> }>;
  total: number;
}
interface Segment {
  id: string;
  object: string;
  name: string;
  query: string;
  spec: FilterSpec;
}

/** Human-readable operator labels for the parsed-filter chips. */
const OP_LABEL: Record<string, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  notContains: 'does not contain',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'in',
  notIn: 'not in',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

function describeCondition(c: SpecCondition): string {
  const op = OP_LABEL[c.op] ?? c.op;
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty') return `${c.field} ${op}`;
  const val = Array.isArray(c.value) ? c.value.join(', ') : String(c.value ?? '');
  return `${c.field} ${op} ${val}`;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(cellText).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['label', 'name', 'title', 'value']) {
      const c = o[k];
      if (typeof c === 'string' || typeof c === 'number') return String(c);
    }
  }
  return '';
}

export function ListBuilderClient({
  objects,
}: {
  objects: ListBuilderObject[];
}): React.ReactElement {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [object, setObject] = React.useState(objects[0]?.slug ?? '');
  const [query, setQuery] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [segmentName, setSegmentName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const refreshSegments = React.useCallback(async () => {
    const res = await listSegmentsTw(undefined, activeProjectId ?? undefined);
    if (res.ok) setSegments(res.data);
  }, [activeProjectId]);

  React.useEffect(() => {
    void refreshSegments();
  }, [refreshSegments]);

  async function run(): Promise<void> {
    const q = query.trim();
    if (!q || !object) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const res = await nlBuildListTw(object, q, activeProjectId ?? undefined);
    setRunning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
  }

  async function save(): Promise<void> {
    if (!result) return;
    const name = segmentName.trim();
    if (!name) {
      toast({ title: 'Name your segment', tone: 'danger' });
      return;
    }
    setSaving(true);
    const res = await saveSegmentTw(
      { object: result.object, name, query: query.trim(), spec: result.spec },
      activeProjectId ?? undefined,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save segment', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Segment saved', description: name, tone: 'success' });
    setSegmentName('');
    void refreshSegments();
  }

  async function removeSegment(id: string): Promise<void> {
    const res = await deleteSegmentTw(id, activeProjectId ?? undefined);
    if (!res.ok) {
      toast({ title: 'Could not delete segment', description: res.error, tone: 'danger' });
      return;
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  function loadSegment(s: Segment): void {
    setObject(s.object);
    setQuery(s.query || '');
  }

  const objectOptions = objects.map((o) => ({ value: o.slug, label: o.labelPlural }));

  return (
    <div className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>List builder</PageTitle>
          <PageDescription>
            Describe the records you want in plain language — we turn it into a
            safe, reviewable filter and run it across your records.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
        <Field label="Object">
          <SelectField
            options={objectOptions}
            value={object}
            onChange={(v) => setObject(v ?? '')}
            placeholder="Choose an object"
          />
        </Field>
        <Field label="Your request">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. open enterprise deals over $10k created last month"
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run();
            }}
          />
        </Field>
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            iconLeft={Play}
            onClick={run}
            loading={running}
            disabled={running || !query.trim() || !object}
          >
            Build list
          </Button>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {running && <Skeleton className="h-40 w-full" />}

      {result && (
        <>
          <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--st-text)]">
              <FilterIcon size={15} aria-hidden="true" />
              Parsed filter
            </div>
            {result.spec.conditions.length === 0 ? (
              <span className="text-[13px] text-[var(--st-text-secondary)]">No conditions.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.spec.conditions.map((c, i) => (
                  <Badge key={`${c.field}-${c.op}-${i}`} tone="accent" kind="soft">
                    {describeCondition(c)}
                  </Badge>
                ))}
              </div>
            )}
            {result.spec.unresolved && (
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                Could not express: {result.spec.unresolved}
              </span>
            )}
            <div className="flex items-end gap-2 border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
              <Field label="Save as segment" className="flex-1">
                <Input
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g. Hot enterprise pipeline"
                />
              </Field>
              <Button
                variant="secondary"
                iconLeft={Bookmark}
                onClick={save}
                loading={saving}
                disabled={saving || !segmentName.trim()}
              >
                Save
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-[var(--st-space-2)] p-[var(--st-space-4)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--st-text)]">
                {result.total} match{result.total === 1 ? '' : 'es'}
              </span>
            </div>
            {result.records.length === 0 ? (
              <span className="text-[13px] text-[var(--st-text-secondary)]">
                No records matched this filter.
              </span>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Record</Th>
                    {result.spec.conditions.slice(0, 3).map((c) => (
                      <Th key={c.field}>{c.field}</Th>
                    ))}
                  </Tr>
                </THead>
                <TBody>
                  {result.records.map((r) => (
                    <Tr key={r._id}>
                      <Td>
                        <Link
                          href={`/sabcrm/${r.object}/${r._id}`}
                          className="text-[var(--st-accent)] hover:underline"
                        >
                          {r.label || `${r.object} ${r._id.slice(-6)}`}
                        </Link>
                      </Td>
                      {result.spec.conditions.slice(0, 3).map((c) => (
                        <Td key={c.field}>{cellText(r.data?.[c.field])}</Td>
                      ))}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {segments.length > 0 && (
        <Card className="flex flex-col gap-[var(--st-space-2)] p-[var(--st-space-4)]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--st-text)]">
            <Sparkles size={15} aria-hidden="true" />
            Saved segments
          </div>
          <div className="flex flex-col gap-1">
            {segments.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-[var(--st-radius-sm)] px-2 py-1.5 hover:bg-[var(--st-surface-hover)]"
              >
                <button
                  type="button"
                  onClick={() => loadSegment(s)}
                  className="flex flex-1 items-center gap-2 text-left text-[13px] text-[var(--st-text)]"
                >
                  <span className="font-medium">{s.name}</span>
                  <Badge tone="neutral" kind="soft">
                    {s.object}
                  </Badge>
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    {s.spec.conditions.length} condition{s.spec.conditions.length === 1 ? '' : 's'}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  aria-label={`Delete segment ${s.name}`}
                  onClick={() => removeSegment(s.id)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
