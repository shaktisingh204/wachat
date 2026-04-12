'use client';

/**
 * Wachat Notification Preferences — toggle notification settings.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuBell, LuMessageSquare, LuUserPlus, LuRadio, LuTriangleAlert, LuFileCheck, LuCoins } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

type NotifSetting = { id: string; label: string; description: string; icon: React.ElementType; enabled: boolean };

const DEFAULT_SETTINGS: NotifSetting[] = [
  { id: 'new_message', label: 'New Message', description: 'Get notified when a new message arrives.', icon: LuMessageSquare, enabled: true },
  { id: 'new_contact', label: 'New Contact', description: 'Get notified when a new contact is added.', icon: LuUserPlus, enabled: true },
  { id: 'broadcast_complete', label: 'Broadcast Complete', description: 'Get notified when a broadcast finishes sending.', icon: LuRadio, enabled: false },
  { id: 'system_alerts', label: 'System Alerts', description: 'Critical system notifications and downtime alerts.', icon: LuTriangleAlert, enabled: true },
  { id: 'template_approved', label: 'Template Approved', description: 'Get notified when a template is approved by WhatsApp.', icon: LuFileCheck, enabled: false },
  { id: 'low_credits', label: 'Low Credits', description: 'Alert when your messaging credits are running low.', icon: LuCoins, enabled: true },
];

export default function NotificationPreferencesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotifSetting[]>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(true);

  const toggle = (id: string) => {
    setSettings((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    toast({ title: 'Saved', description: 'Notification preferences updated.' });
  };

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
        <ClayButton variant="obsidian" size="sm" onClick={handleSave} disabled={saved}>
          {saved ? 'All Saved' : 'Save Changes'}
        </ClayButton>
      </div>

      <ClayCard padded={false} className="divide-y divide-clay-border">
        {settings.map((s) => (
          <div key={s.id} className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2 shrink-0">
              <s.icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-clay-ink">{s.label}</div>
              <div className="text-[12.5px] text-clay-ink-muted">{s.description}</div>
            </div>
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${s.enabled ? 'bg-emerald-500' : 'bg-clay-surface-2'}`}
              aria-label={`Toggle ${s.label}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${s.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
