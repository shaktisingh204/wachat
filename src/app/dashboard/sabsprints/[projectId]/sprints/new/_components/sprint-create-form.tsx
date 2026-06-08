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
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { createSprint } from '@/app/actions/agile.actions';
import { Repeat } from 'lucide-react';

export function SprintCreateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
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
          tone: 'danger',
        });
        return;
      }
      toast({ title: 'Sprint created', tone: 'success' });
      router.push(
        `/dashboard/sabsprints/${projectId}/sprints/${res.data._id}/plan`,
      );
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Repeat size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
          <CardTitle>New sprint</CardTitle>
        </div>
        <CardDescription>
          Set the scope window and capacity, then pull stories in from the backlog.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardBody>
          <div className="flex flex-col gap-4">
            <Field label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sprint 42"
                required
              />
            </Field>
            <Field label="Goal">
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What does success look like at the end of this sprint?"
                rows={3}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Capacity (story points)"
              help="The total points the team expects to deliver this sprint."
            >
              <Input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) =>
                  setCapacity(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="40"
                className="tabular-nums"
              />
            </Field>
          </div>
        </CardBody>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={isPending}
            disabled={!name.trim()}
          >
            Create sprint
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
