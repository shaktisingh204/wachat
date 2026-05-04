'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuSave, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getAwayMessage, saveAwayMessage } from '@/app/actions/wachat-features.actions';

type Schedule = 'always' | 'outside_hours' | 'custom';

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
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      if (res.config) {
        setEnabled(res.config.enabled ?? false);
        setMessage(res.config.message ?? '');
        setSchedule((res.config.schedule as Schedule) || 'outside_hours');
        if (res.config.timeFrom) setCustomStart(res.config.timeFrom);
        if (res.config.timeTo) setCustomEnd(res.config.timeTo);
      }
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveAwayMessage(projectId, enabled, message, schedule, customStart, customEnd);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Saved', description: 'Away message settings updated.' });
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Away Messages' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Away Messages</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Set an auto-reply for when you are unavailable or outside business hours.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Enable Away Message</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Automatically reply when you are not available.</p>
          </div>
          <button type="button" onClick={() => setEnabled(!enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </ClayCard>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Message</h2>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          placeholder="Type your away message..." className="clay-input min-h-[96px] resize-y py-2.5 w-full" />
      </ClayCard>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Schedule</h2>
        <div className="space-y-2">
          {([
            { value: 'always', label: 'Always send', desc: 'Reply to every incoming message' },
            { value: 'outside_hours', label: 'Outside business hours', desc: 'Uses your configured business hours' },
            { value: 'custom', label: 'Custom times', desc: 'Set specific active hours' },
          ] as const).map((opt) => (
            <label key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${schedule === opt.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input type="radio" name="schedule" value={opt.value} checked={schedule === opt.value}
                onChange={() => setSchedule(opt.value)} className="mt-0.5 accent-primary" />
              <div>
                <span className="text-[13px] font-medium text-foreground">{opt.label}</span>
                <p className="text-[11.5px] text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {schedule === 'custom' && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-[12px] text-muted-foreground">From</label>
            <input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
            <label className="text-[12px] text-muted-foreground">To</label>
            <input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
          </div>
        )}
      </ClayCard>

      <div className="flex items-center gap-3">
        <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving} leading={<LuSave className="h-4 w-4" />}>
          {isSaving ? 'Saving...' : 'Save Away Message'}
        </ClayButton>
      </div>
      <div className="h-6" />
    </div>
  );
}
