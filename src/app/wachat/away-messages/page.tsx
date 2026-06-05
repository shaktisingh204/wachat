'use client';

import {
  Button,
  Card,
  Field,
  Input,
  RadioCard,
  RadioCardGroup,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Save } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getAwayMessage,
  saveAwayMessage,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/away-messages — auto-reply for offline / outside-hours.
 * 20ui: WachatPage frame + Switch + RadioCard for schedule,
 * Textarea for body. Skeleton on initial load.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type Schedule = 'always' | 'outside_hours' | 'custom';

const SCHEDULE_OPTIONS: { value: Schedule; label: string; desc: string }[] = [
  {
    value: 'always',
    label: 'Always send',
    desc: 'Reply to every incoming message',
  },
  {
    value: 'outside_hours',
    label: 'Outside business hours',
    desc: 'Uses your configured business hours',
  },
  {
    value: 'custom',
    label: 'Custom times',
    desc: 'Set specific active hours',
  },
];

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Away Messages' },
];

export default function AwayMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [schedule, setSchedule] = useState<Schedule>('outside_hours');
  const [customStart, setCustomStart] = useState('18:00');
  const [customEnd, setCustomEnd] = useState('09:00');
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getAwayMessage(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      if (res.config) {
        setEnabled(res.config.enabled ?? false);
        setMessage(res.config.message ?? '');
        setSchedule((res.config.schedule as Schedule) || 'outside_hours');
        if (res.config.timeFrom) setCustomStart(res.config.timeFrom);
        if (res.config.timeTo) setCustomEnd(res.config.timeTo);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveAwayMessage(
        projectId,
        enabled,
        message,
        schedule,
        customStart,
        customEnd,
      );
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Saved', description: 'Away message settings updated.', tone: 'success' });
    });
  };

  if (isLoading) {
    return (
      <WachatPage width="narrow">
        <Skeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
      </WachatPage>
    );
  }

  return (
    <WachatPage
      width="narrow"
      breadcrumb={BREADCRUMB}
      eyebrow="WaChat"
      title="Away Messages"
      description="Set an auto-reply for when you are unavailable or outside business hours."
      actions={
        <Button variant="primary" onClick={handleSave} loading={isSaving} iconLeft={Save}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="grid gap-4">
        {/* Activate switch */}
        <Card padding="lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
                Enable away message
              </h2>
              <p
                className="mt-0.5 text-[12.5px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                Automatically reply when you are not available.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable away message"
            />
          </div>
        </Card>

        {/* Message body */}
        <Card padding="lg">
          <Field label="Message">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your away message…"
              className="min-h-[96px]"
            />
          </Field>
        </Card>

        {/* Schedule */}
        <Card padding="lg">
          <div className="flex flex-col gap-3">
            <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
              Schedule
            </h2>
            <RadioCardGroup
              value={schedule}
              onChange={(v) => setSchedule(v as Schedule)}
              label="Away message schedule"
              className="grid gap-2"
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.desc}
                />
              ))}
            </RadioCardGroup>

            {schedule === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
                <Field label="From">
                  <Input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </Card>
      </div>
    </WachatPage>
  );
}
