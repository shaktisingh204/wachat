'use client';

import { Badge, Button, Card, StatCard, Switch, useZoruToast } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ListTodo,
  XCircle,
} from 'lucide-react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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

  // Derive KPI values from settings
  const enabledCount = ITEMS.filter(({ module }) => isEnabled(module)).length;
  const disabledCount = ITEMS.length - enabledCount;

  return (
    <EntityListShell
      title="Time Tracking Settings"
      subtitle="Choose whether time is logged against projects, tasks, or both."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total modules"
          value={ITEMS.length}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Enabled"
          value={enabledCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Disabled"
          value={disabledCount}
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      <Card className="p-6">
        <div className="divide-y divide-zoru-line">
          {ITEMS.map(({ module, label, description, icon: Icon }) => {
            const enabled = isEnabled(module);
            return (
              <div
                key={module}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
                    <Icon
                      className="h-4.5 w-4.5 text-zoru-ink"
                      strokeWidth={1.75}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-zoru-ink">
                        {label}
                      </p>
                      <Badge variant={enabled ? 'success' : 'ghost'}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
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
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>
    </EntityListShell>
  );
}
