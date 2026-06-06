'use client';

/**
 * Epics module — left pane is a list of epics with a create form. Right
 * pane is a roadmap timeline: one row per epic, bar position derived from
 * `startDate` / `endDate`, with a stacked count of attached stories.
 */
import { useMemo, useState, useTransition } from 'react';

import { Badge, Button, Card, EmptyState, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
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
          variant: 'destructive',
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
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">New epic</h2>
        <form className="flex flex-col gap-3" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="epic-name">Name</Label>
            <Input
              id="epic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="epic-desc">Description</Label>
            <Textarea
              id="epic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="epic-color">Color</Label>
            <Input
              id="epic-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 p-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="epic-start">Start</Label>
              <Input
                id="epic-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="epic-end">End</Label>
              <Input
                id="epic-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending || !name.trim()}>
            Create epic
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">Roadmap</h2>
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
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: epic.color ?? '#94a3b8' }}
                    />
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {epic.name}
                    </span>
                    <Badge variant="ghost">{count} stories</Badge>
                    <Badge variant="ghost">{epic.status}</Badge>
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
