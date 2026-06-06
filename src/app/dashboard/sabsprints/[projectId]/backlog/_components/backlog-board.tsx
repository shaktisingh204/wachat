'use client';

/**
 * Backlog board — prioritised, drag-reorderable list grouped by epic.
 *
 * Drag uses native HTML5 DnD (no extra dep). We commit reorder via a single
 * `reorderStories` action: each item gets a new linear `rank` derived from
 * its index. Points are edited inline via a number input that fires
 * `updateStory` on blur.
 */
import { useMemo, useState, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import {
  createStory,
  reorderStories,
  updateStory,
  moveStory,
} from '@/app/actions/agile.actions';
import type { AgileEpicDoc } from '@/lib/rust-client/agile-epics';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';
import type {
  AgileStoryDoc,
  AgileStoryPriority,
} from '@/lib/rust-client/agile-stories';

const PRIORITY_VARIANTS: Record<
  AgileStoryPriority,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  low: 'ghost',
  medium: 'success',
  high: 'warning',
  urgent: 'danger',
};

interface Props {
  projectId: string;
  initialStories: AgileStoryDoc[];
  epics: AgileEpicDoc[];
  sprints: AgileSprintDoc[];
}

interface GroupedRow {
  epicId: string | null;
  epicName: string;
  color?: string;
  stories: AgileStoryDoc[];
}

function groupByEpic(
  stories: AgileStoryDoc[],
  epics: AgileEpicDoc[],
): GroupedRow[] {
  const epicMap = new Map(epics.map((e) => [e._id, e]));
  const buckets = new Map<string | null, AgileStoryDoc[]>();
  for (const s of stories) {
    const key = s.epicId ?? null;
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }
  const rows: GroupedRow[] = [];
  for (const [key, items] of buckets.entries()) {
    const epic = key ? epicMap.get(key) : null;
    rows.push({
      epicId: key,
      epicName: epic?.name ?? 'No epic',
      color: epic?.color,
      stories: items,
    });
  }
  // Stable ordering: stories with epics first, alphabetised, then 'No epic'.
  rows.sort((a, b) => {
    if (a.epicId == null && b.epicId != null) return 1;
    if (b.epicId == null && a.epicId != null) return -1;
    return a.epicName.localeCompare(b.epicName);
  });
  return rows;
}

export function BacklogBoard({
  projectId,
  initialStories,
  epics,
  sprints,
}: Props) {
  const [stories, setStories] = useState(initialStories);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => groupByEpic(stories, epics), [stories, epics]);

  function persistOrder(next: AgileStoryDoc[]) {
    setStories(next);
    const payload = next.map((s, i) => ({ id: s._id, rank: (i + 1) * 100 }));
    startTransition(async () => {
      await reorderStories(payload, projectId);
    });
  }

  function handleDrop(targetIdx: number) {
    if (!draggingId) return;
    const fromIdx = stories.findIndex((s) => s._id === draggingId);
    if (fromIdx === -1 || fromIdx === targetIdx) return;
    const next = [...stories];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, moved);
    setDraggingId(null);
    persistOrder(next);
  }

  function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const res = await createStory({ projectId, title });
      if (res.ok) {
        setStories((prev) => [...prev, res.data]);
        setNewTitle('');
      }
    });
  }

  function handlePointsChange(id: string, points: number) {
    setStories((prev) =>
      prev.map((s) => (s._id === id ? { ...s, points } : s)),
    );
    startTransition(async () => {
      await updateStory(id, { points }, projectId);
    });
  }

  function handleMoveToSprint(id: string, sprintId: string) {
    startTransition(async () => {
      await moveStory(id, { sprintId }, projectId);
      setStories((prev) => prev.filter((s) => s._id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New story title…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button onClick={handleCreate} disabled={isPending || !newTitle.trim()}>
            Add story
          </Button>
        </div>
      </Card>

      {grouped.length === 0 ? (
        <EmptyState
          title="No backlog stories yet"
          description="Add your first story above to start grooming the backlog."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((row) => (
            <section key={row.epicId ?? 'none'} className="flex flex-col gap-2">
              <header className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: row.color ?? 'var(--zoru-line-strong)' }}
                />
                <h2 className="text-sm font-semibold text-zoru-ink">
                  {row.epicName}
                </h2>
                <span className="text-xs text-zoru-ink-subtle">
                  {row.stories.length} stories
                </span>
              </header>
              <ol className="flex flex-col gap-1.5">
                {row.stories.map((s) => {
                  const overallIdx = stories.findIndex(
                    (x) => x._id === s._id,
                  );
                  const isDragging = draggingId === s._id;
                  return (
                    <li
                      key={s._id}
                      draggable
                      onDragStart={() => setDraggingId(s._id)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(overallIdx)}
                      aria-grabbed={isDragging}
                      className="flex items-center gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-3 py-2 hover:border-zoru-line-strong cursor-grab"
                    >
                      <span
                        aria-hidden
                        className="text-xs text-zoru-ink-subtle font-mono w-6"
                      >
                        #{overallIdx + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-zoru-ink">
                        {s.title}
                      </span>
                      <Badge variant={PRIORITY_VARIANTS[s.priority] ?? 'ghost'}>
                        {s.priority}
                      </Badge>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="w-16 text-right"
                        defaultValue={s.points ?? ''}
                        onBlur={(e) => {
                          const v = Number(e.currentTarget.value);
                          if (!Number.isNaN(v) && v !== s.points) {
                            handlePointsChange(s._id, v);
                          }
                        }}
                        aria-label={`Points for ${s.title}`}
                      />
                      <Select
                        onValueChange={(value) => handleMoveToSprint(s._id, value)}
                      >
                        <ZoruSelectTrigger className="w-40">
                          <ZoruSelectValue placeholder="Move to sprint…" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          {sprints
                            .filter((sp) => sp.status !== 'completed' && sp.status !== 'cancelled')
                            .map((sp) => (
                              <ZoruSelectItem key={sp._id} value={sp._id}>
                                {sp.name}
                              </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
