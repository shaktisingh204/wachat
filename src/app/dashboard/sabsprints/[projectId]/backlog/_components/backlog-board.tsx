'use client';

/**
 * Backlog board — prioritised, drag-reorderable story list grouped by epic.
 *
 * Drag uses native HTML5 DnD (no extra dep). We commit reorder via a single
 * `reorderStories` action: each item gets a new linear `rank` derived from
 * its index. Points are edited inline via a number input that fires
 * `updateStory` on blur. A KPI strip summarises the grooming state.
 */
import { useMemo, useState, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyState,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  createStory,
  reorderStories,
  updateStory,
  moveStory,
} from '@/app/actions/agile.actions';
import {
  ListChecks,
  Target,
  Flame,
  Layers,
  GripVertical,
  Plus,
  ArrowRight,
} from 'lucide-react';
import type { AgileEpicDoc } from '@/lib/rust-client/agile-epics';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';
import type {
  AgileStoryDoc,
  AgileStoryPriority,
} from '@/lib/rust-client/agile-stories';

const PRIORITY_TONES: Record<AgileStoryPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
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

  const totalPoints = useMemo(
    () => stories.reduce((acc, s) => acc + (s.points ?? 0), 0),
    [stories],
  );
  const urgentCount = useMemo(
    () => stories.filter((s) => s.priority === 'urgent' || s.priority === 'high').length,
    [stories],
  );

  const activeSprints = useMemo(
    () =>
      sprints.filter(
        (sp) => sp.status !== 'completed' && sp.status !== 'cancelled',
      ),
    [sprints],
  );

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
    <div className="flex flex-col gap-6">
      <section
        aria-label="Backlog summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="Backlog stories" value={stories.length} icon={ListChecks} />
        <StatCard label="Unplanned points" value={totalPoints} icon={Target} />
        <StatCard label="High priority" value={urgentCount} icon={Flame} />
        <StatCard label="Epics" value={epics.length} icon={Layers} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Add a story</CardTitle>
          <CardDescription>
            Capture a new item, then groom its priority, points, and epic below.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="As a user, I want to…"
              aria-label="New story title"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={handleCreate}
              disabled={isPending || !newTitle.trim()}
            >
              Add story
            </Button>
          </div>
        </CardBody>
      </Card>

      {grouped.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={ListChecks}
            title="No backlog stories yet"
            description="Add your first story above to start grooming the backlog into sprints."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map((row) => (
            <Card key={row.epicId ?? 'none'} padding="none">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        row.color ?? 'var(--st-border-strong)',
                    }}
                  />
                  <CardTitle>{row.epicName}</CardTitle>
                  <Badge tone="neutral">{row.stories.length} stories</Badge>
                </div>
              </CardHeader>
              <CardBody>
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
                        className={[
                          'flex items-center gap-3 rounded-[var(--st-radius-sm)] border bg-[var(--st-bg)] px-3 py-2 transition-colors duration-150 cursor-grab',
                          isDragging
                            ? 'border-[var(--st-accent)] opacity-60'
                            : 'border-[var(--st-border)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]',
                        ].join(' ')}
                      >
                        <GripVertical
                          size={15}
                          aria-hidden="true"
                          className="shrink-0 text-[var(--st-text-tertiary)]"
                        />
                        <span className="w-7 shrink-0 font-mono text-xs tabular-nums text-[var(--st-text-tertiary)]">
                          #{overallIdx + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-[var(--st-text)]">
                          {s.title}
                        </span>
                        <Badge tone={PRIORITY_TONES[s.priority] ?? 'neutral'} dot>
                          {s.priority}
                        </Badge>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputSize="sm"
                          className="w-16 text-right tabular-nums"
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
                          onValueChange={(value) =>
                            handleMoveToSprint(s._id, value)
                          }
                        >
                          <SelectTrigger
                            className="w-44"
                            aria-label={`Move ${s.title} to sprint`}
                          >
                            <ArrowRight
                              size={14}
                              aria-hidden="true"
                              className="text-[var(--st-text-tertiary)]"
                            />
                            <SelectValue placeholder="Move to sprint" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeSprints.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                No open sprints
                              </SelectItem>
                            ) : (
                              activeSprints.map((sp) => (
                                <SelectItem key={sp._id} value={sp._id}>
                                  {sp.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ol>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
