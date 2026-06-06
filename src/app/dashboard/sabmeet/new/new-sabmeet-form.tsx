'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Textarea, PageHeader, PageTitle, PageDescription, PageActions } from '@/components/sabcrm/20ui';
import { ArrowLeft } from 'lucide-react';
import { createMeetRoom } from '@/app/actions/sabmeet.actions';

export function NewMeetingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [mode, setMode] = React.useState<'instant' | 'scheduled'>('scheduled');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const inviteesRaw = String(fd.get('invitees') ?? '');
      const invitees = inviteesRaw
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean);

      const res = await createMeetRoom({
        name: String(fd.get('name') ?? ''),
        description: String(fd.get('description') ?? '') || undefined,
        scheduledStart:
          mode === 'scheduled' && fd.get('scheduledStart')
            ? new Date(String(fd.get('scheduledStart'))).toISOString()
            : undefined,
        scheduledEnd:
          mode === 'scheduled' && fd.get('scheduledEnd')
            ? new Date(String(fd.get('scheduledEnd'))).toISOString()
            : undefined,
        timezone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
        inviteeEmails: invitees,
        passcode: String(fd.get('passcode') ?? '') || undefined,
        lobbyEnabled: fd.get('lobbyEnabled') === 'on',
        recordingEnabled: fd.get('recordingEnabled') === 'on',
        requireAuth: fd.get('requireAuth') === 'on',
      });
      if (res.success) {
        if (mode === 'instant') {
          router.push(`/dashboard/meetings/${res.data._id}/lobby`);
        } else {
          router.push('/dashboard/meetings');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <div>
          <PageTitle>New meeting</PageTitle>
          <PageDescription>
            Create an instant or scheduled video conference.
          </PageDescription>
        </div>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <form onSubmit={handleSubmit} className="grid gap-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type</CardTitle>
            <CardDescription>Start now or schedule for later.</CardDescription>
          </CardHeader>
          <CardBody className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode('instant')}
              className={`flex-1 rounded-lg border p-4 text-left transition ${mode === 'instant' ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/5' : 'border-[var(--st-border)]'}`}
            >
              <div className="font-medium text-[var(--st-text)]">Instant</div>
              <div className="text-xs text-[var(--st-text-secondary)] mt-1">Start the meeting immediately.</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('scheduled')}
              className={`flex-1 rounded-lg border p-4 text-left transition ${mode === 'scheduled' ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/5' : 'border-[var(--st-border)]'}`}
            >
              <div className="font-medium text-[var(--st-text)]">Scheduled</div>
              <div className="text-xs text-[var(--st-text-secondary)] mt-1">Pick a start/end time and invite people.</div>
            </button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required maxLength={120} placeholder="Weekly sync" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Agenda or notes"
              />
            </div>
            {mode === 'scheduled' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="scheduledStart">Start time *</Label>
                  <Input id="scheduledStart" name="scheduledStart" type="datetime-local" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduledEnd">End time</Label>
                  <Input id="scheduledEnd" name="scheduledEnd" type="datetime-local" />
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="invitees">Invitees (comma or newline separated emails)</Label>
              <Textarea
                id="invitees"
                name="invitees"
                rows={3}
                placeholder="alice@example.com, bob@example.com"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security &amp; options</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="passcode">Passcode (optional)</Label>
              <Input id="passcode" name="passcode" type="text" maxLength={32} placeholder="Leave blank for none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox name="lobbyEnabled" defaultChecked />
              <span className="text-sm text-[var(--st-text)]">Enable waiting lobby (host admits guests)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox name="recordingEnabled" />
              <span className="text-sm text-[var(--st-text)]">Record this meeting</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox name="requireAuth" />
              <span className="text-sm text-[var(--st-text)]">Require signed-in users only (no guests)</span>
            </label>
          </CardBody>
        </Card>

        {error ? (
          <div className="rounded-md border border-[var(--st-border)]/40 bg-[var(--st-text)]/5 text-sm text-[var(--st-text)] px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/meetings">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : mode === 'instant' ? 'Start meeting' : 'Schedule meeting'}
          </Button>
        </div>
      </form>
    </div>
  );
}
