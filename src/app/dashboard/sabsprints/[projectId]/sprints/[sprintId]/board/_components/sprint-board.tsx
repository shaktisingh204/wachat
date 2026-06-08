'use client';

/**
 * Sprint-board view (Kanban). Four fixed columns drive `status` on
 * `agile_stories`. Drag a card between columns to update its status. A summary
 * card carries sprint metadata, status, and the start/complete lifecycle
 * action; a KPI strip tracks delivery against commitment.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  CardBody,
  StatCard,
  Dot,
  Progress,
  type BadgeTone,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  completeSprint,
  startSprint,
  updateStory,
} from '@/app/actions/agile.actions';
import {
  Target,
  CheckCircle2,
  Layers as LayersIcon,
  TrendingUp,
  LineChart,
  Play,
  Flag,
  GripVertical,
} from 'lucide-react';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';
import type {
  AgileStoryDoc,
  AgileStoryStatus,
  AgileStoryPriority,
} from '@/lib/rust-client/agile-stories';

const COLUMNS: Array<{ key: AgileStoryStatus; label: string; tone: BadgeTone }> = [
  { key: 'todo', label: 'To do', tone: 'neutral' },
  { key: 'in_progress', label: 'In progress', tone: 'info' },
  { key: 'review', label: 'Review', tone: 'warning' },
  { key: 'done', label: 'Done', tone: 'success' },
];

const PRIORITY_TONES: Record<AgileStoryPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  planned: 'info',
  active: 'accent',
  completed: 'success',
  cancelled: 'neutral',
};

interface Props {
  projectId: string;
  sprint: AgileSprintDoc;
  initialStories: AgileStoryDoc[];
}

function sumPoints(stories: AgileStoryDoc[]): number {
  return stories.reduce((acc, s) => acc + (s.points ?? 0), 0);
}

export function SprintBoard({ projectId, sprint, initialStories }: Props) {
  const { toast } = useToast();
  const [stories, setStories] = useState(initialStories);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byCol = useMemo(() => {
    const map = new Map<AgileStoryStatus, AgileStoryDoc[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const s of stories) {
      const list = map.get(s.status as AgileStoryStatus);
      if (list) list.push(s);
    }
    return map;
  }, [stories]);

  const committed = useMemo(() => sumPoints(stories), [stories]);
  const done = useMemo(
    () => sumPoints(stories.filter((s) => s.status === 'done')),
    [stories],
  );
  const pct = committed > 0 ? Math.round((done / committed) * 100) : 0;

  function dropOn(col: AgileStoryStatus) {
    if (!draggingId) return;
    const story = stories.find((s) => s._id === draggingId);
    if (!story || story.status === col) {
      setDraggingId(null);
      return;
    }
    setStories((prev) =>
      prev.map((s) => (s._id === draggingId ? { ...s, status: col } : s)),
    );
    setDraggingId(null);
    startTransition(async () => {
      await updateStory(story._id, { status: col }, projectId);
    });
  }

  function handleStart() {
    startTransition(async () => {
      const res = await startSprint(sprint._id, projectId);
      if (!res.ok) {
        toast({
          title: 'Could not start sprint',
          description: res.error,
          tone: 'danger',
        });
      }
    });
  }

  function handleComplete() {
    const planned = sumPoints(stories);
    const completed = sumPoints(stories.filter((s) => s.status === 'done'));
    startTransition(async () => {
      const res = await completeSprint(sprint._id, projectId, {
        sprintName: sprint.name,
        plannedPoints: planned,
        completedPoints: completed,
      });
      if (!res.ok) {
        toast({
          title: 'Could not complete sprint',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      toast({
        title: 'Sprint completed',
        description: `${completed} of ${planned} points logged to velocity.`,
        tone: 'success',
      });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
                  {sprint.name}
                </h2>
                <Badge tone={STATUS_TONE[sprint.status] ?? 'neutral'} dot>
                  {sprint.status}
                </Badge>
              </div>
              {sprint.goal ? (
                <p className="max-w-prose text-sm text-[var(--st-text-secondary)]">
                  {sprint.goal}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/sabsprints/${projectId}/sprints/${sprint._id}/burndown`}
                >
                  <LineChart size={16} aria-hidden="true" />
                  Burndown
                </Link>
              </Button>
              {sprint.status === 'planned' ? (
                <Button
                  variant="primary"
                  iconLeft={Play}
                  onClick={handleStart}
                  disabled={isPending}
                >
                  Start sprint
                </Button>
              ) : sprint.status === 'active' ? (
                <Button
                  variant="primary"
                  iconLeft={Flag}
                  onClick={handleComplete}
                  disabled={isPending}
                >
                  Complete sprint
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
              <span>Progress</span>
              <span className="tabular-nums font-medium text-[var(--st-text)]">
                {done} / {committed} pts ({pct}%)
              </span>
            </div>
            <Progress
              value={pct}
              tone={pct === 100 ? 'success' : 'accent'}
              size="sm"
              aria-label={`${sprint.name} progress`}
            />
          </div>
        </CardBody>
      </Card>

      <section
        aria-label="Sprint metrics"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="Stories" value={stories.length} icon={LayersIcon} />
        <StatCard label="Committed points" value={committed} icon={Target} />
        <StatCard label="Completed points" value={done} icon={CheckCircle2} />
        <StatCard label="Completion" value={`${pct}%`} icon={TrendingUp} />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = byCol.get(col.key) ?? [];
          return (
            <Card
              key={col.key}
              padding="sm"
              className="flex flex-col gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(col.key)}
            >
              <header className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Dot tone={col.tone} aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[var(--st-text)]">
                    {col.label}
                  </h3>
                </div>
                <span className="tabular-nums text-xs text-[var(--st-text-tertiary)]">
                  {items.length} · {sumPoints(items)} pts
                </span>
              </header>
              {items.length === 0 ? (
                <p className="rounded-[var(--st-radius-sm)] border border-dashed border-[var(--st-border)] px-3 py-6 text-center text-xs text-[var(--st-text-tertiary)]">
                  Drop stories here
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((s) => (
                    <li
                      key={s._id}
                      draggable
                      onDragStart={() => setDraggingId(s._id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={[
                        'group cursor-grab rounded-[var(--st-radius-sm)] border bg-[var(--st-bg)] p-2.5 transition-colors duration-150',
                        draggingId === s._id
                          ? 'border-[var(--st-accent)] opacity-60'
                          : 'border-[var(--st-border)] hover:border-[var(--st-border-strong)]',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical
                          size={14}
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-[var(--st-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
                        />
                        <p className="line-clamp-2 flex-1 text-sm text-[var(--st-text)]">
                          {s.title}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge tone={PRIORITY_TONES[s.priority] ?? 'neutral'}>
                          {s.priority}
                        </Badge>
                        <span className="tabular-nums text-xs text-[var(--st-text-tertiary)]">
                          {s.points ?? 0} pts
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
