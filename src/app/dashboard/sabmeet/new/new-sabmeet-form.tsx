'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Textarea,
  Field,
  Alert,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { ArrowLeft, FileText, ShieldCheck, Zap } from 'lucide-react';
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
    <main className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabMeet</PageEyebrow>
          <PageTitle>New meeting</PageTitle>
          <PageDescription>
            Create an instant or scheduled video conference.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="outline"
            iconLeft={ArrowLeft}
            onClick={() => router.push('/dashboard/meetings')}
          >
            Back
          </Button>
        </PageActions>
      </PageHeader>

      <form onSubmit={handleSubmit} className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            <CardTitle className="text-base">Meeting type</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <SegmentedControl
              aria-label="Meeting type"
              value={mode}
              onChange={setMode}
              items={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'instant', label: 'Instant' },
              ]}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              {mode === 'instant'
                ? 'Start the meeting immediately and bring people in from the lobby.'
                : 'Pick a start and end time, then invite people by email.'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Name" required id="name">
              <Input name="name" required maxLength={120} placeholder="Weekly sync" />
            </Field>
            <Field label="Description" id="description">
              <Textarea name="description" rows={3} placeholder="Agenda or notes" />
            </Field>
            {mode === 'scheduled' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start time" required id="scheduledStart">
                  <Input name="scheduledStart" type="datetime-local" required />
                </Field>
                <Field label="End time" id="scheduledEnd">
                  <Input name="scheduledEnd" type="datetime-local" />
                </Field>
              </div>
            ) : null}
            <Field
              label="Invitees"
              help="Comma or newline separated emails."
              id="invitees"
            >
              <Textarea
                name="invitees"
                rows={3}
                placeholder="alice@example.com, bob@example.com"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            <CardTitle className="text-base">Security and options</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Passcode" help="Optional. Leave blank for none." id="passcode">
              <Input name="passcode" type="text" maxLength={32} placeholder="Leave blank for none" />
            </Field>
            <Checkbox
              name="lobbyEnabled"
              defaultChecked
              label="Enable waiting lobby (host admits guests)"
            />
            <Checkbox name="recordingEnabled" label="Record this meeting" />
            <Checkbox
              name="requireAuth"
              label="Require signed-in users only (no guests)"
            />
          </CardBody>
        </Card>

        {error ? (
          <Alert tone="danger" title="Could not create meeting">
            {error}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/meetings')}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? 'Creating' : mode === 'instant' ? 'Start meeting' : 'Schedule meeting'}
          </Button>
        </div>
      </form>
    </main>
  );
}
