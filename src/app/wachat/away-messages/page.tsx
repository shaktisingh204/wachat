'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruRadioCard,
  RadioGroup,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getAwayMessage,
  saveAwayMessage,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/away-messages — auto-reply for offline / outside-hours.
 * ZoruUI: header + breadcrumb, Switch + ZoruRadioCard for schedule,
 * Textarea for body. Skeleton on initial load.
 */

import * as React from 'react';

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

export default function AwayMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved', description: 'Away message settings updated.' });
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Away Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Away Messages</ZoruPageTitle>
          <ZoruPageDescription>
            Set an auto-reply for when you are unavailable or outside business
            hours.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save /> {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 grid gap-4">
        {/* Activate switch */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] text-zoru-ink">Enable away message</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
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
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            <Label htmlFor="away-body">Message</Label>
            <Textarea
              id="away-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your away message…"
              className="min-h-[96px]"
            />
          </div>
        </Card>

        {/* Schedule */}
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            <h2 className="text-[15px] text-zoru-ink">Schedule</h2>
            <RadioGroup
              value={schedule}
              onValueChange={(v) => setSchedule(v as Schedule)}
              className="grid gap-2"
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <ZoruRadioCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.desc}
                />
              ))}
            </RadioGroup>

            {schedule === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="time-from">From</Label>
                  <Input
                    id="time-from"
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="time-to">To</Label>
                  <Input
                    id="time-to"
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
