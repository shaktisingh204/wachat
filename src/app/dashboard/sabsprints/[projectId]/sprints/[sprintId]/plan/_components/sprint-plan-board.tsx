'use client';

/**
 * Two-pane sprint planner. Drag a backlog story into the sprint pane to
 * assign it; drag a sprint story back to detach it. Capacity meter shows
 * sum of points vs the sprint's `capacityPoints`.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  Progress,
} from '@/components/sabcrm/20ui/compat';
import { moveStory } from '@/app/actions/agile.actions';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';
import type { AgileStoryDoc } from '@/lib/rust-client/agile-stories';

interface Props {
  projectId: string;
  sprint: AgileSprintDoc;
  initialBacklog: AgileStoryDoc[];
  initialSprintStories: AgileStoryDoc[];
}

function sumPoints(stories: AgileStoryDoc[]): number {
  return stories.reduce((acc, s) => acc + (s.points ?? 0), 0);
}

export function SprintPlanBoard({
  projectId,
  sprint,
  initialBacklog,
  initialSprintStories,
}: Props) {
  const [backlog, setBacklog] = useState(initialBacklog);
  const [sprintStories, setSprintStories] = useState(initialSprintStories);
  const [, startTransition] = useTransition();

  const allocated = useMemo(() => sumPoints(sprintStories), [sprintStories]);
  const capacity = sprint.capacityPoints ?? 0;
  const pct = capacity > 0 ? Math.min(100, (allocated / capacity) * 100) : 0;
  const over = capacity > 0 && allocated > capacity;

  function moveToSprint(story: AgileStoryDoc) {
    setBacklog((prev) => prev.filter((s) => s._id !== story._id));
    setSprintStories((prev) => [...prev, { ...story, sprintId: sprint._id }]);
    startTransition(async () => {
      await moveStory(story._id, { sprintId: sprint._id }, projectId);
    });
  }

  function moveToBacklog(story: AgileStoryDoc) {
    setSprintStories((prev) => prev.filter((s) => s._id !== story._id));
    setBacklog((prev) => [...prev, { ...story, sprintId: undefined }]);
    startTransition(async () => {
      await moveStory(story._id, { sprintId: null }, projectId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-[var(--st-text)]">{sprint.name}</h2>
            {sprint.goal ? (
              <p className="text-sm text-[var(--st-text-secondary)]">{sprint.goal}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="ghost">{sprint.status}</Badge>
            {sprint.status === 'planned' ? (
              <Link
                href={`/dashboard/sabsprints/${projectId}/sprints/${sprint._id}/board`}
              >
                <Button>Start sprint</Button>
              </Link>
            ) : (
              <Link
                href={`/dashboard/sabsprints/${projectId}/sprints/${sprint._id}/board`}
              >
                <Button variant="outline">Open board</Button>
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
            <span>Allocated</span>
            <span>
              {allocated} / {capacity || '—'} pts
              {over ? ' (over capacity)' : ''}
            </span>
          </div>
          <Progress value={pct} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Pane
          label="Backlog"
          stories={backlog}
          emptyHint="No backlog stories left to add."
          actionLabel="Add to sprint"
          onAction={moveToSprint}
        />
        <Pane
          label={`In ${sprint.name}`}
          stories={sprintStories}
          emptyHint="Drag stories from the backlog to plan this sprint."
          actionLabel="Move to backlog"
          onAction={moveToBacklog}
        />
      </div>
    </div>
  );
}

function Pane({
  label,
  stories,
  emptyHint,
  actionLabel,
  onAction,
}: {
  label: string;
  stories: AgileStoryDoc[];
  emptyHint: string;
  actionLabel: string;
  onAction: (s: AgileStoryDoc) => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--st-text)]">{label}</h3>
        <span className="text-xs text-[var(--st-text-tertiary)]">
          {stories.length} &middot; {sumPoints(stories)} pts
        </span>
      </div>
      {stories.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--st-text-tertiary)]">
          {emptyHint}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {stories.map((s) => (
            <li
              key={s._id}
              className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
            >
              <span className="flex-1 truncate text-sm text-[var(--st-text)]">
                {s.title}
              </span>
              <Badge variant="ghost">{s.points ?? 0} pts</Badge>
              <Button size="sm" variant="ghost" onClick={() => onAction(s)}>
                {actionLabel}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
