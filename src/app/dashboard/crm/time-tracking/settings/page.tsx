'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Settings as SettingsIcon, Briefcase, ListTodo } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getLogTimeSettings,
  setLogTimeFor,
} from '@/app/actions/worksuite/time.actions';
import type { WsLogTimeFor, WsLogTimeModule } from '@/lib/worksuite/time-types';

const ITEMS: {
  module: WsLogTimeModule;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    module: 'projects',
    label: 'Projects',
    description: 'Allow logging time directly against a project.',
    icon: Briefcase,
  },
  {
    module: 'tasks',
    label: 'Tasks',
    description: 'Allow logging time against individual tasks within a project.',
    icon: ListTodo,
  },
];

export default function TimeTrackingSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WsLogTimeFor[]>([]);
  const [, startLoading] = useTransition();
  const [busy, setBusy] = useState<WsLogTimeModule | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const list = await getLogTimeSettings();
      setSettings(list);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isEnabled = (m: WsLogTimeModule): boolean => {
    const found = settings.find((s) => s.module === m);
    // Default to enabled (both on) when nothing saved yet.
    return found ? Boolean(found.is_enabled) : true;
  };

  const toggle = async (m: WsLogTimeModule, next: boolean) => {
    setBusy(m);
    const res = await setLogTimeFor(m, next);
    setBusy(null);
    if (res.ok) {
      toast({
        title: 'Saved',
        description: `Log time for ${m} is now ${next ? 'enabled' : 'disabled'}.`,
      });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Time Tracking Settings"
        subtitle="Choose whether time is logged against projects, tasks, or both."
        icon={SettingsIcon}
      />

      <ClayCard>
        <div className="divide-y divide-border">
          {ITEMS.map(({ module, label, description, icon: Icon }) => {
            const enabled = isEnabled(module);
            return (
              <div
                key={module}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Icon
                      className="h-4.5 w-4.5 text-accent-foreground"
                      strokeWidth={1.75}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-foreground">
                        {label}
                      </p>
                      <ClayBadge tone={enabled ? 'green' : 'neutral'} dot>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </ClayBadge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enabled}
                    disabled={busy === module}
                    onCheckedChange={(v) => toggle(module, Boolean(v))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ClayCard>

      <div className="flex justify-end">
        <ClayButton variant="pill" onClick={refresh}>
          Refresh
        </ClayButton>
      </div>
    </div>
  );
}
