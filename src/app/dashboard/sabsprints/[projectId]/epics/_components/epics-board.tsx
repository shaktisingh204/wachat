'use client';

/**
 * Epics module. The left pane is a list of epics with a create form. The right
 * pane is a roadmap timeline: one row per epic, bar position derived from
 * startDate / endDate, with a stacked count of attached stories.
 */
import { useMemo, useState, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ColorPicker,
  EmptyState,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { createEpic } from '@/app/actions/agile.actions';
import type { AgileEpicDoc } from '@/lib/rust-client/agile-epics';
import type { AgileStoryDoc } from '@/lib/rust-client/agile-stories';

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
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="flex flex-col gap-3">
        <CardHeader>
          <CardTitle>New epic</CardTitle>
        </CardHeader>
        <form className="flex flex-col gap-3" onSubmit={handleCreate}>
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Color">
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
            loading={isPending}
            disabled={!name.trim()}
          >
            Create epic
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
        </CardHeader>
        {epics.length === 0 ? (
          <EmptyState
            title="No epics yet"
            description="Use the form to create an epic and start grouping stories."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {epics.map((epic) => {
              const count = storyCountByEpic.get(epic._id) ?? 0;
              let barLeft = 0;
              let barWidth = 100;
              if (bounds && epic.startDate && epic.endDate) {
                barLeft = pctOf(new Date(epic.startDate).getTime(), bounds);
                const right = pctOf(new Date(epic.endDate).getTime(), bounds);
                barWidth = Math.max(2, right - barLeft);
              }
              return (
                <li key={epic._id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: epic.color ?? '#94a3b8' }}
                    />
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {epic.name}
                    </span>
                    <Badge tone="neutral">{count} stories</Badge>
                    <Badge tone="neutral">{epic.status}</Badge>
                  </div>
                  <div className="relative h-3 w-full rounded-full bg-[var(--st-border)]">
                    <div
                      className="absolute h-3 rounded-full"
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
      </Card>
    </div>
  );
}
