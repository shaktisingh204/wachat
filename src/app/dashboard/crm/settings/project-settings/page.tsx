'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { FolderKanban, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
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
  getProjectSettings,
  saveProjectSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsProjectSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

const inputClass =
  'h-10 rounded-lg border-border bg-card text-[13px]';

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
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card/50 px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={name} className="text-[13px] font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Project Settings"
        subtitle="Milestones, time tracking, views, and creation defaults for the project module."
        icon={FolderKanban}
      />

      {isLoading && !settings ? (
        <ClayCard>
          <Skeleton className="h-[420px] w-full" />
        </ClayCard>
      ) : (
        <ClayCard>
          <form action={formAction} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Defaults
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="default_status" className="text-[13px] text-foreground">
                    Default Status
                  </Label>
                  <Input
                    id="default_status"
                    name="default_status"
                    placeholder="not_started"
                    defaultValue={settings?.default_status ?? 'not_started'}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="default_priority" className="text-[13px] text-foreground">
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
                Save Project Settings
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      )}
    </div>
  );
}
