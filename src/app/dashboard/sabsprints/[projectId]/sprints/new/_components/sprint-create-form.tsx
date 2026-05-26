'use client';

/**
 * Create-sprint form. Minimal fields per Zoho Sprints parity: name, goal,
 * start/end dates, capacity (points). Submits and routes to the new sprint's
 * plan view so the user can immediately drag stories in.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { createSprint } from '@/app/actions/agile.actions';

export function SprintCreateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');

  function toIso(date: string): string | undefined {
    if (!date) return undefined;
    // <input type="date"> gives YYYY-MM-DD; promote to UTC midnight.
    return new Date(`${date}T00:00:00.000Z`).toISOString();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createSprint({
        projectId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate: toIso(startDate),
        endDate: toIso(endDate),
        capacityPoints: capacity === '' ? undefined : Number(capacity),
      });
      if (!res.ok) {
        toast({
          title: 'Could not create sprint',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Sprint created' });
      router.push(
        `/dashboard/sabsprints/${projectId}/sprints/${res.data._id}/plan`,
      );
    });
  }

  return (
    <Card className="max-w-xl p-6">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sprint-name">Name</Label>
          <Input
            id="sprint-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sprint 1"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sprint-goal">Goal</Label>
          <Textarea
            id="sprint-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What does success look like at the end of this sprint?"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-start">Start date</Label>
            <Input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-end">End date</Label>
            <Input
              id="sprint-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sprint-capacity">Capacity (story points)</Label>
          <Input
            id="sprint-capacity"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) =>
              setCapacity(e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="e.g. 40"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending || !name.trim()}>
            {isPending ? 'Creating…' : 'Create sprint'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
