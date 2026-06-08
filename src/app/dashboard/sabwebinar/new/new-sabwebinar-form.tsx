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
  Callout,
  Field,
  Input,
  Textarea,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import { createSabwebinar } from '@/app/actions/sabwebinar.actions';
import { Presentation, Calendar, Users, Sparkles } from 'lucide-react';

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
      setError('Add a title before creating the webinar.');
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
        setError(err instanceof Error ? err.message : 'We could not create the webinar. Please try again.');
      }
    });
  };

  return (
    <div className="20ui mx-auto flex w-full max-w-[1000px] flex-col gap-6 p-4 md:p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabWebinar</PageEyebrow>
          <PageTitle>New webinar</PageTitle>
          <PageDescription>
            Schedule a branded one-to-many broadcast. You can configure the landing page,
            polls, and Q&amp;A after it is created.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Presentation size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
                <CardTitle>Basics</CardTitle>
              </div>
              <CardDescription>Public-facing details shown on the landing page.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Field label="Title" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Q4 product launch"
                  autoFocus
                  required
                />
              </Field>
              <Field label="Description" help="A short summary of what attendees will learn.">
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
                  placeholder="Priya Nair"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
                <CardTitle>Schedule</CardTitle>
              </div>
              <CardDescription>When the broadcast starts and how many can attend.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
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
                <Field label="Capacity" help="Leave blank for unlimited.">
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="Unlimited"
                  />
                </Field>
              </div>
              <Field label="Timezone">
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  iconLeft={Users}
                />
              </Field>
            </CardBody>
          </Card>

          {error ? (
            <Alert tone="danger" title="Could not create webinar">
              {error}
            </Alert>
          ) : null}

          <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
            <Button type="submit" variant="primary" loading={pending}>
              {pending ? 'Creating' : 'Create webinar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card variant="outlined" padding="md">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <span className="text-sm font-medium text-[var(--st-text)]">Before you go live</span>
            </div>
            <ul className="flex flex-col gap-2 text-sm text-[var(--st-text-secondary)]">
              <li>The webinar starts as a draft, so nothing is published yet.</li>
              <li>Brand the landing page and set a hero image after creation.</li>
              <li>Add polls and a Q&amp;A queue from the detail view.</li>
            </ul>
          </Card>
          <Separator />
          <Callout tone="info" title="Registration is on by default">
            Attendees register through the public landing page and receive a unique join link.
          </Callout>
        </aside>
      </form>
    </div>
  );
}
