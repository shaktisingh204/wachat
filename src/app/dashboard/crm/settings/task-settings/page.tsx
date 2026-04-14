'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { ListChecks, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getTaskSettings,
  saveTaskSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsTaskSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

const inputClass =
  'h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]';

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
    <div className="flex items-start justify-between gap-4 rounded-clay-md border border-clay-border bg-clay-surface/50 px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={name} className="text-[13px] font-medium text-clay-ink">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-clay-ink-muted">{description}</p>
        ) : null}
      </div>
      <Switch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function TaskSettingsPage() {
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Task Settings"
        subtitle="Task-module behaviour: subtasks, dependencies, time logs, ratings, and defaults."
        icon={ListChecks}
      />

      {isLoading && !settings ? (
        <ClayCard>
          <Skeleton className="h-[400px] w-full" />
        </ClayCard>
      ) : (
        <ClayCard>
          <form action={formAction} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-clay-ink-muted">
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
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                Defaults
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="default_priority" className="text-[13px] text-clay-ink">
                    Default Priority
                  </Label>
                  <Select
                    name="default_priority"
                    defaultValue={settings?.default_priority ?? 'medium'}
                  >
                    <SelectTrigger id="default_priority" className={`mt-1.5 ${inputClass}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                Save Task Settings
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      )}
    </div>
  );
}
