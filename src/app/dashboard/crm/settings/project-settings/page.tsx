'use client';

import { Button, Card, Label, Skeleton, StatCard, Switch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { CheckCircle2, LoaderCircle, LayoutDashboard, Milestone } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getProjectSettings,
  saveProjectSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsProjectSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState<boolean>(!!defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <div className="flex-1">
        <ZoruLabel htmlFor={name} className="text-[13px] text-zoru-ink">
          {label}
        </ZoruLabel>
        {description ? (
          <p className="mt-0.5 text-[12px] text-zoru-ink-muted">{description}</p>
        ) : null}
      </div>
      <ZoruSwitch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<WsProjectSetting | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveProjectSettings,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const s = await getProjectSettings();
      setSettings(s);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  return (
    <EntityListShell
      title="Project Settings"
      subtitle="Milestones, time tracking, views, and creation defaults for the project module."
    >
      {settings ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ZoruStatCard
            label="Milestones"
            value={settings.enable_milestones ? 'Enabled' : 'Disabled'}
            icon={<Milestone className="h-4 w-4" />}
          />
          <ZoruStatCard
            label="Time tracking"
            value={settings.enable_time_tracking ? 'Enabled' : 'Disabled'}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <ZoruStatCard
            label="Kanban"
            value={settings.enable_kanban ? 'Enabled' : 'Disabled'}
            icon={<LayoutDashboard className="h-4 w-4" />}
          />
          <ZoruStatCard
            label="Client portal"
            value={settings.enable_client_portal ? 'Enabled' : 'Disabled'}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      ) : null}
      {isLoading && !settings ? (
        <ZoruCard className="p-6">
          <ZoruSkeleton className="h-[420px] w-full" />
        </ZoruCard>
      ) : (
        <ZoruCard className="p-6">
          <form action={formAction} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                Feature Toggles
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  name="enable_milestones"
                  label="Enable milestones"
                  defaultChecked={settings?.enable_milestones ?? true}
                />
                <ToggleRow
                  name="enable_time_tracking"
                  label="Enable time tracking"
                  defaultChecked={settings?.enable_time_tracking ?? true}
                />
                <ToggleRow
                  name="enable_kanban"
                  label="Enable Kanban view"
                  defaultChecked={settings?.enable_kanban ?? true}
                />
                <ToggleRow
                  name="enable_gantt"
                  label="Enable Gantt view"
                  defaultChecked={settings?.enable_gantt ?? false}
                />
                <ToggleRow
                  name="enable_client_portal"
                  label="Enable client portal"
                  description="Clients can view progress, files, and invoices"
                  defaultChecked={settings?.enable_client_portal ?? false}
                />
                <ToggleRow
                  name="require_client"
                  label="Require a client on create"
                  defaultChecked={settings?.require_client ?? false}
                />
                <ToggleRow
                  name="require_deadline"
                  label="Require a deadline on create"
                  defaultChecked={settings?.require_deadline ?? false}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                Defaults
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <ZoruLabel htmlFor="default_status" className="text-[13px] text-zoru-ink">
                    Default Status
                  </ZoruLabel>
                  <div className="mt-1.5">
                    <EnumFormField
                      name="default_status"
                      enumName="projectStatus"
                      initialId={settings?.default_status ?? 'not_started'}
                    />
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="default_priority" className="text-[13px] text-zoru-ink">
                    Default Priority
                  </ZoruLabel>
                  <div className="mt-1.5">
                    <EnumFormField
                      name="default_priority"
                      enumName="priorityMedium"
                      initialId={settings?.default_priority ?? 'medium'}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Project Settings
              </ZoruButton>
            </div>
          </form>
        </ZoruCard>
      )}
    </EntityListShell>
  );
}
