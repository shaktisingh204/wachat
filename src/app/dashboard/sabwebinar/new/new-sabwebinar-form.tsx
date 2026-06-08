'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Textarea,
  PageHeader,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
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
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageTitle>New webinar</PageTitle>
        <PageDescription>
          Schedule a branded one-to-many broadcast. You can configure the landing page,
          polls, and Q&A after creation.
        </PageDescription>
      </PageHeader>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Public-facing details for the landing page.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Q4 product launch"
                required
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="What attendees will learn"
              />
            </Field>
            <Field label="Host name">
              <Input
                value={form.hostName}
                onChange={(e) => setForm({ ...form, hostName: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Starts at">
                <Input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                />
              </Field>
              <Field label="Duration (min)">
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                />
              </Field>
              <Field label="Capacity (optional)">
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Unlimited"
                />
              </Field>
            </div>
            {error ? (
              <Alert tone="danger" title="Could not create webinar">
                {error}
              </Alert>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" loading={pending}>
                {pending ? 'Creating...' : 'Create webinar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
