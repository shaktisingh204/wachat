'use client';

import { Button, Card, Label, Skeleton, StatCard, Switch, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { CheckCircle2, GitBranch, LoaderCircle, RefreshCw } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getTaskSettings,
  saveTaskSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsTaskSetting } from '@/lib/worksuite/module-settings-types';

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
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={name} className="text-[13px] text-[var(--st-text)]">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">{description}</p>
        ) : null}
      </div>
      <Switch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function TaskSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<WsTaskSetting | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveTaskSettings,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const s = await getTaskSettings();
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
      title="Task Settings"
      subtitle="Task-module behaviour: subtasks, dependencies, time logs, ratings, and defaults."
    >
      {settings ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Subtasks"
            value={settings.enable_subtasks ? 'Enabled' : 'Disabled'}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Dependencies"
            value={settings.enable_dependencies ? 'Enabled' : 'Disabled'}
            icon={<GitBranch className="h-4 w-4" />}
          />
          <StatCard
            label="Recurring tasks"
            value={settings.enable_recurring_tasks ? 'Enabled' : 'Disabled'}
            icon={<RefreshCw className="h-4 w-4" />}
          />
          <StatCard
            label="Time logging"
            value={settings.enable_time_logs ? 'Enabled' : 'Disabled'}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      ) : null}
      {isLoading && !settings ? (
        <Card className="p-6">
          <Skeleton className="h-[400px] w-full" />
        </Card>
      ) : (
        <Card className="p-6">
          <form action={formAction} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Feature Toggles
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  name="enable_subtasks"
                  label="Enable subtasks"
                  defaultChecked={settings?.enable_subtasks ?? true}
                />
                <ToggleRow
                  name="enable_dependencies"
                  label="Enable task dependencies"
                  defaultChecked={settings?.enable_dependencies ?? false}
                />
                <ToggleRow
                  name="enable_recurring_tasks"
                  label="Enable recurring tasks"
                  defaultChecked={settings?.enable_recurring_tasks ?? false}
                />
                <ToggleRow
                  name="enable_time_logs"
                  label="Enable time logging"
                  defaultChecked={settings?.enable_time_logs ?? true}
                />
                <ToggleRow
                  name="enable_task_ratings"
                  label="Enable task ratings"
                  defaultChecked={settings?.enable_task_ratings ?? false}
                />
                <ToggleRow
                  name="auto_assign_creator"
                  label="Auto-assign creator"
                  description="New tasks are automatically assigned to the author"
                  defaultChecked={settings?.auto_assign_creator ?? false}
                />
                <ToggleRow
                  name="require_due_date"
                  label="Require a due date"
                  defaultChecked={settings?.require_due_date ?? false}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Defaults
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="default_priority" className="text-[13px] text-[var(--st-text)]">
                    Default Priority
                  </Label>
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Task Settings
              </Button>
            </div>
          </form>
        </Card>
      )}
    </EntityListShell>
  );
}
