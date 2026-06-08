'use client';

/**
 * Epics module. The left pane is a create form. The right pane is a roadmap
 * timeline: one row per epic, bar position derived from startDate / endDate,
 * with a count of attached stories and a status badge. A KPI strip summarises
 * the epic mix.
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
  ColorPicker,
  EmptyState,
  Field,
  Input,
  Textarea,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { createEpic } from '@/app/actions/agile.actions';
import { Layers, Loader2, CheckCircle2, ListTodo, Plus, Map as MapIcon } from 'lucide-react';
import type {
  AgileEpicDoc,
  AgileEpicStatus,
} from '@/lib/rust-client/agile-epics';
import type { AgileStoryDoc } from '@/lib/rust-client/agile-stories';

const STATUS_TONE: Record<AgileEpicStatus, BadgeTone> = {
  in_progress: 'accent',
  planned: 'info',
  completed: 'success',
  archived: 'neutral',
};

interface Props {
  projectId: string;
  initialEpics: AgileEpicDoc[];
  stories: AgileStoryDoc[];
}

interface Bounds {
  min: number;
  max: number;
}

function epicBounds(epics: AgileEpicDoc[]): Bounds | null {
  const dates: number[] = [];
  for (const e of epics) {
    if (e.startDate) dates.push(new Date(e.startDate).getTime());
    if (e.endDate) dates.push(new Date(e.endDate).getTime());
  }
  if (dates.length < 2) return null;
  return { min: Math.min(...dates), max: Math.max(...dates) };
}

function pctOf(value: number, bounds: Bounds): number {
  return ((value - bounds.min) / (bounds.max - bounds.min)) * 100;
}

export function EpicsBoard({ projectId, initialEpics, stories }: Props) {
  const { toast } = useToast();
  const [epics, setEpics] = useState(initialEpics);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPending, startTransition] = useTransition();

  const storyCountByEpic = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stories) {
      if (s.epicId) {
        map.set(s.epicId, (map.get(s.epicId) ?? 0) + 1);
      }
    }
    return map;
  }, [stories]);

  const bounds = useMemo(() => epicBounds(epics), [epics]);

  const activeCount = useMemo(
    () => epics.filter((e) => e.status === 'in_progress').length,
    [epics],
  );
  const completedCount = useMemo(
    () => epics.filter((e) => e.status === 'completed').length,
    [epics],
  );
  const linkedStories = useMemo(
    () => stories.filter((s) => s.epicId).length,
    [stories],
  );

  function toIso(d: string): string | undefined {
    return d ? new Date(`${d}T00:00:00.000Z`).toISOString() : undefined;
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createEpic({
        projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        startDate: toIso(startDate),
        endDate: toIso(endDate),
      });
      if (!res.ok) {
        toast({
          title: 'Could not create epic',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      setEpics((prev) => [...prev, res.data]);
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Epic summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="Total epics" value={epics.length} icon={Layers} />
        <StatCard label="In progress" value={activeCount} icon={Loader2} />
        <StatCard label="Completed" value={completedCount} icon={CheckCircle2} />
        <StatCard label="Linked stories" value={linkedStories} icon={ListTodo} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus
                size={16}
                aria-hidden="true"
                className="text-[var(--st-accent)]"
              />
              <CardTitle>New epic</CardTitle>
            </div>
            <CardDescription>Group related stories into one initiative.</CardDescription>
          </CardHeader>
          <CardBody>
            <form className="flex flex-col gap-3" onSubmit={handleCreate}>
              <Field label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Authentication overhaul"
                  required
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this initiative delivers and why it matters."
                />
              </Field>
              <Field label="Colour">
                <ColorPicker value={color} onChange={setColor} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="End">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                type="submit"
                variant="primary"
                iconLeft={Plus}
                loading={isPending}
                disabled={!name.trim()}
              >
                Create epic
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapIcon size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <CardTitle>Roadmap</CardTitle>
            </div>
            <CardDescription>
              Each epic plotted across its date window, with attached story counts.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {epics.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No epics yet"
                description="Create your first epic to start grouping backlog stories into a larger initiative."
              />
            ) : (
              <ol className="flex flex-col gap-4">
                {epics.map((epic) => {
                  const count = storyCountByEpic.get(epic._id) ?? 0;
                  let barLeft = 0;
                  let barWidth = 100;
                  if (bounds && epic.startDate && epic.endDate) {
                    barLeft = pctOf(new Date(epic.startDate).getTime(), bounds);
                    const right = pctOf(
                      new Date(epic.endDate).getTime(),
                      bounds,
                    );
                    barWidth = Math.max(2, right - barLeft);
                  }
                  return (
                    <li key={epic._id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: epic.color ?? '#94a3b8' }}
                        />
                        <span className="flex-1 truncate text-sm font-medium text-[var(--st-text)]">
                          {epic.name}
                        </span>
                        <Badge tone="neutral">{count} stories</Badge>
                        <Badge tone={STATUS_TONE[epic.status] ?? 'neutral'} dot>
                          {epic.status}
                        </Badge>
                      </div>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--st-bg-secondary)]">
                        <div
                          className="absolute inset-y-0 rounded-full"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                            backgroundColor: epic.color ?? '#6366f1',
                          }}
                          aria-label={`${epic.name} timeline`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
