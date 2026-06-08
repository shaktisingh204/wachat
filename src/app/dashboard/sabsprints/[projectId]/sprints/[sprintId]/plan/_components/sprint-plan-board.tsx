'use client';

/**
 * Two-pane sprint planner. Move a backlog story into the sprint pane to
 * assign it; move a sprint story back to detach it. A capacity meter shows
 * the sum of allocated points vs the sprint's declared `capacityPoints`.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Progress,
  EmptyState,
  type Ui20ProgressTone,
} from '@/components/sabcrm/20ui';
import { moveStory } from '@/app/actions/agile.actions';
import {
  Target,
  Layers as LayersIcon,
  ListChecks,
  Play,
  LayoutDashboard,
  ArrowRight,
  ArrowLeft,
  Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
  const meterTone: Ui20ProgressTone = over ? 'danger' : 'accent';

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
                  {sprint.name}
                </h2>
                <Badge tone="neutral" dot>
                  {sprint.status}
                </Badge>
              </div>
              {sprint.goal ? (
                <p className="max-w-prose text-sm text-[var(--st-text-secondary)]">
                  {sprint.goal}
                </p>
              ) : null}
            </div>
            <Button
              variant={sprint.status === 'planned' ? 'primary' : 'outline'}
              asChild
            >
              <Link
                href={`/dashboard/sabsprints/${projectId}/sprints/${sprint._id}/board`}
              >
                {sprint.status === 'planned' ? (
                  <Play size={16} aria-hidden="true" />
                ) : (
                  <LayoutDashboard size={16} aria-hidden="true" />
                )}
                {sprint.status === 'planned' ? 'Start sprint' : 'Open board'}
              </Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
              <span>Allocated capacity</span>
              <span className="tabular-nums font-medium text-[var(--st-text)]">
                {allocated} / {capacity || '—'} pts
                {over ? ' · over capacity' : ''}
              </span>
            </div>
            <Progress
              value={pct}
              tone={meterTone}
              size="sm"
              aria-label="Allocated capacity"
            />
          </div>
        </CardBody>
      </Card>

      <section
        aria-label="Planning summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="In sprint" value={sprintStories.length} icon={LayersIcon} />
        <StatCard label="Allocated points" value={allocated} icon={Target} />
        <StatCard label="Backlog left" value={backlog.length} icon={ListChecks} />
        <StatCard
          label="Capacity"
          value={capacity || '—'}
          icon={Target}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Pane
          label="Backlog"
          icon={Inbox}
          stories={backlog}
          emptyTitle="Backlog is clear"
          emptyHint="Every story is already assigned to a sprint."
          actionLabel="Add to sprint"
          actionIcon={ArrowRight}
          onAction={moveToSprint}
        />
        <Pane
          label={`In ${sprint.name}`}
          icon={LayersIcon}
          stories={sprintStories}
          emptyTitle="Nothing planned yet"
          emptyHint="Add stories from the backlog to build out this sprint."
          actionLabel="Move to backlog"
          actionIcon={ArrowLeft}
          onAction={moveToBacklog}
        />
      </div>
    </div>
  );
}

function Pane({
  label,
  icon: Icon,
  stories,
  emptyTitle,
  emptyHint,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}: {
  label: string;
  icon: LucideIcon;
  stories: AgileStoryDoc[];
  emptyTitle: string;
  emptyHint: string;
  actionLabel: string;
  actionIcon: LucideIcon;
  onAction: (s: AgileStoryDoc) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
            <CardTitle>{label}</CardTitle>
          </div>
          <span className="tabular-nums text-xs text-[var(--st-text-tertiary)]">
            {stories.length} · {sumPoints(stories)} pts
          </span>
        </div>
      </CardHeader>
      <CardBody>
        {stories.length === 0 ? (
          <EmptyState icon={Icon} title={emptyTitle} description={emptyHint} size="sm" />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {stories.map((s) => (
              <li
                key={s._id}
                className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 transition-colors duration-150 hover:border-[var(--st-border-strong)]"
              >
                <span className="flex-1 truncate text-sm text-[var(--st-text)]">
                  {s.title}
                </span>
                <Badge tone="neutral">{s.points ?? 0} pts</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={ActionIcon}
                  onClick={() => onAction(s)}
                >
                  {actionLabel}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
