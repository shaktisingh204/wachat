'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Textarea, PageHeader, PageTitle, PageDescription } from '@/components/sabcrm/20ui/compat';
import { createSabwebinar } from '@/app/actions/sabwebinar.actions';

export function NewSabwebinarForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    hostName: '',
    scheduledStart: '',
    durationMinutes: '60',
    capacity: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    startTransition(async () => {
      try {
        const res = await createSabwebinar({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          hostName: form.hostName.trim() || undefined,
          scheduledStart: form.scheduledStart
            ? new Date(form.scheduledStart).toISOString()
            : undefined,
          durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          timezone: form.timezone || undefined,
        });
        router.push(`/dashboard/sabwebinar/${res.data._id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create webinar');
      }
    });
  };

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageTitle>New webinar</PageTitle>
        <PageDescription>
          Schedule a branded one-to-many broadcast. You can configure the landing page,
          polls, and Q&amp;A after creation.
        </PageDescription>
      </PageHeader>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Public-facing details for the landing page.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Q4 product launch"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="What attendees will learn"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hostName">Host name</Label>
              <Input
                id="hostName"
                value={form.hostName}
                onChange={(e) => setForm({ ...form, hostName: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="scheduledStart">Starts at</Label>
                <Input
                  id="scheduledStart"
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="durationMinutes">Duration (min)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min={5}
                  max={600}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capacity">Capacity (optional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            {error ? <p className="text-sm text-[var(--st-text)]">{error}</p> : null}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create webinar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
