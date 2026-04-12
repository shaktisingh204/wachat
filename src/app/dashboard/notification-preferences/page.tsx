'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuMessageSquare, LuUserPlus, LuRadio, LuTriangleAlert, LuFileCheck, LuCoins, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getNotificationPreferences, saveNotificationPreferences } from '@/app/actions/wachat-features.actions';

type NotifDef = { id: string; label: string; description: string; icon: React.ElementType };

const NOTIF_DEFS: NotifDef[] = [
  { id: 'new_message', label: 'New Message', description: 'Get notified when a new message arrives.', icon: LuMessageSquare },
  { id: 'new_contact', label: 'New Contact', description: 'Get notified when a new contact is added.', icon: LuUserPlus },
  { id: 'broadcast_complete', label: 'Broadcast Complete', description: 'Get notified when a broadcast finishes sending.', icon: LuRadio },
  { id: 'system_alerts', label: 'System Alerts', description: 'Critical system notifications and downtime alerts.', icon: LuTriangleAlert },
  { id: 'template_approved', label: 'Template Approved', description: 'Get notified when a template is approved by WhatsApp.', icon: LuFileCheck },
  { id: 'low_credits', label: 'Low Credits', description: 'Alert when your messaging credits are running low.', icon: LuCoins },
];

export default function NotificationPreferencesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getNotificationPreferences(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      if (res.prefs) {
        const map: Record<string, boolean> = {};
        for (const def of NOTIF_DEFS) map[def.id] = res.prefs[def.id] ?? false;
        setPrefs(map);
      } else {
        const defaults: Record<string, boolean> = {};
        for (const def of NOTIF_DEFS) defaults[def.id] = false;
        setPrefs(defaults);
      }
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (id: string) => {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveNotificationPreferences(projectId, prefs);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setDirty(false);
      toast({ title: 'Saved', description: 'Notification preferences updated.' });
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-clay-ink-muted" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Notification Preferences' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Notification Preferences</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Control which notifications you receive from Wachat.</p>
        </div>
        <ClayButton variant="obsidian" size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
          {isSaving ? 'Saving...' : dirty ? 'Save Changes' : 'All Saved'}
        </ClayButton>
      </div>

      <ClayCard padded={false} className="divide-y divide-clay-border">
        {NOTIF_DEFS.map((def) => {
          const Icon = def.icon;
          return (
            <div key={def.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2 shrink-0">
                <Icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-clay-ink">{def.label}</div>
                <div className="text-[12.5px] text-clay-ink-muted">{def.description}</div>
              </div>
              <button type="button" onClick={() => toggle(def.id)}
                className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${prefs[def.id] ? 'bg-emerald-500' : 'bg-clay-surface-2'}`}
                aria-label={`Toggle ${def.label}`}>
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[def.id] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
