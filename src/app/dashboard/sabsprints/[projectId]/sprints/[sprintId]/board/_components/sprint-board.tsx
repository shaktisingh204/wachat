'use client';

/**
 * Sprint-board view (Kanban). Four fixed columns drive `status` on
 * `agile_stories`. Drag a card between columns to update its status.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  completeSprint,
  startSprint,
  updateStory,
} from '@/app/actions/agile.actions';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';
import type {
  AgileStoryDoc,
  AgileStoryStatus,
} from '@/lib/rust-client/agile-stories';

const COLUMNS: Array<{ key: AgileStoryStatus; label: string; tint: string }> = [
  { key: 'todo', label: 'To Do', tint: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', tint: '#2563eb' },
  { key: 'review', label: 'Review', tint: '#d97706' },
  { key: 'done', label: 'Done', tint: '#16a34a' },
];

interface Props {
  projectId: string;
  sprint: AgileSprintDoc;
  initialStories: AgileStoryDoc[];
}

function sumPoints(stories: AgileStoryDoc[]): number {
  return stories.reduce((acc, s) => acc + (s.points ?? 0), 0);
}

export function SprintBoard({ projectId, sprint, initialStories }: Props) {
  const { toast } = useZoruToast();
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
          variant: 'destructive',
        });
      }
    });
  }

  function handleComplete() {
    const planned = sumPoints(stories);
    const completed = sumPoints(
      stories.filter((s) => s.status === 'done'),
    );
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
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Sprint completed',
        description: `${completed}/${planned} pts logged to velocity.`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">{sprint.name}</h2>
          {sprint.goal ? (
            <p className="text-sm text-[var(--st-text-secondary)]">{sprint.goal}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ghost">{sprint.status}</Badge>
          <Link
            href={`/dashboard/sabsprints/${projectId}/sprints/${sprint._id}/burndown`}
          >
            <Button variant="outline">Burndown</Button>
          </Link>
          {sprint.status === 'planned' ? (
            <Button onClick={handleStart} disabled={isPending}>
              Start sprint
            </Button>
          ) : sprint.status === 'active' ? (
            <Button onClick={handleComplete} disabled={isPending}>
              Complete sprint
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = byCol.get(col.key) ?? [];
          return (
            <Card
              key={col.key}
              className="flex flex-col gap-2 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(col.key)}
            >
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: col.tint }}
                  />
                  <h3 className="text-sm font-semibold text-[var(--st-text)]">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs text-[var(--st-text-tertiary)]">
                  {items.length} &middot; {sumPoints(items)} pts
                </span>
              </header>
              <ul className="flex flex-col gap-2">
                {items.map((s) => (
                  <li
                    key={s._id}
                    draggable
                    onDragStart={() => setDraggingId(s._id)}
                    onDragEnd={() => setDraggingId(null)}
                    className="cursor-grab rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
                  >
                    <p className="text-sm text-[var(--st-text)] line-clamp-2">{s.title}</p>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <Badge variant="ghost">{s.priority}</Badge>
                      <span className="text-[var(--st-text-tertiary)]">
                        {s.points ?? 0} pts
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
