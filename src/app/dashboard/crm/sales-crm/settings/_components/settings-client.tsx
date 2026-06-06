'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Bell, Boxes, Settings2, Users } from 'lucide-react';
import { useTransition } from 'react';

import {
  saveSalesCrmPipelineConfig,
  saveSalesCrmLeadConfig,
  saveSalesCrmDealConfig,
  saveSalesCrmNotificationConfig,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { SalesCrmConfig } from '@/app/actions/worksuite/crm-plus.actions.types';
import type { CrmPipeline } from '@/lib/definitions';
import type { WsLeadStatus } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';

interface Props {
  config: SalesCrmConfig;
  pipelines: CrmPipeline[];
  leadStatuses: Array<WithId<WsLeadStatus> & { _id: string }>;
}

type SaveState = { message?: string; error?: string };

/* ─── Section card wrapper ──────────────────────────────────────── */
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 bg-[var(--st-bg-muted)] border-b border-[var(--st-border)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] [&_svg]:size-4 text-[var(--st-text-secondary)]">
          <Icon />
        </span>
        <div>
          <div className="text-[14px] font-semibold text-[var(--st-text)]">{title}</div>
          <div className="text-[12px] text-[var(--st-text-secondary)]">{description}</div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
      {footer ? (
        <>
          <Separator />
          <div className="px-6 py-4 flex items-center justify-end gap-2">{footer}</div>
        </>
      ) : null}
    </Card>
  );
}

/* ─── Status feedback row ───────────────────────────────────────── */
function SaveFeedback({ state }: { state: SaveState | undefined }) {
  if (!state) return null;
  if (state.error) {
    return (
      <span className="text-[12px] text-[var(--st-danger)]">{state.error}</span>
    );
  }
  if (state.message) {
    return (
      <span className="text-[12px] text-[var(--st-status-ok)]">{state.message}</span>
    );
  }
  return null;
}

/* ─── Toggle row ────────────────────────────────────────────────── */
function ToggleRow({
  label,
  description,
  name,
  defaultChecked,
}: {
  label: string;
  description?: string;
  name: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = React.useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[13px] font-medium text-[var(--st-text)]">{label}</div>
        {description ? (
          <div className="text-[11.5px] text-[var(--st-text-secondary)]">{description}</div>
        ) : null}
      </div>
      {/* Radix Switch does not reliably submit with FormData; use a hidden input */}
      <input type="hidden" name={name} value={checked ? 'on' : 'off'} />
      <Switch
        checked={checked}
        onCheckedChange={setChecked}
        aria-label={label}
      />
    </div>
  );
}

/* ─── Main client component ─────────────────────────────────────── */
export function SettingsClient({ config, pipelines, leadStatuses }: Props) {
  const { toast } = useZoruToast();
  const [pipelinePending, startPipelineTransition] = useTransition();
  const [leadPending, startLeadTransition] = useTransition();
  const [dealPending, startDealTransition] = useTransition();
  const [notifPending, startNotifTransition] = useTransition();

  const [pipelineState, setPipelineState] = React.useState<SaveState | undefined>();
  const [leadState, setLeadState] = React.useState<SaveState | undefined>();
  const [dealState, setDealState] = React.useState<SaveState | undefined>();
  const [notifState, setNotifState] = React.useState<SaveState | undefined>();

  function handlePipelineSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startPipelineTransition(async () => {
      const r = await saveSalesCrmPipelineConfig(undefined as unknown as SaveState, fd);
      setPipelineState(r);
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      else toast({ title: 'Saved', description: r.message });
    });
  }

  function handleLeadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startLeadTransition(async () => {
      const r = await saveSalesCrmLeadConfig(undefined as unknown as SaveState, fd);
      setLeadState(r);
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      else toast({ title: 'Saved', description: r.message });
    });
  }

  function handleDealSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startDealTransition(async () => {
      const r = await saveSalesCrmDealConfig(undefined as unknown as SaveState, fd);
      setDealState(r);
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      else toast({ title: 'Saved', description: r.message });
    });
  }

  function handleNotifSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startNotifTransition(async () => {
      const r = await saveSalesCrmNotificationConfig(undefined as unknown as SaveState, fd);
      setNotifState(r);
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      else toast({ title: 'Saved', description: r.message });
    });
  }

  const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">Sales CRM Settings</h1>
        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
          Configure pipeline behaviour, lead defaults, deal tracking and notification preferences.
        </p>
      </div>

      {/* ── Pipeline settings ──────────────────────────────────── */}
      <form onSubmit={handlePipelineSubmit}>
        <SectionCard
          icon={Settings2}
          title="Pipeline Settings"
          description="Default pipeline and progression behaviour."
          footer={
            <>
              <SaveFeedback state={pipelineState} />
              <Button type="submit" size="sm" disabled={pipelinePending}>
                {pipelinePending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="defaultPipeline">Default Pipeline</Label>
            <Select
              name="defaultPipelineId"
              defaultValue={config.defaultPipelineId ?? '__none__'}
            >
              <ZoruSelectTrigger id="defaultPipeline">
                <ZoruSelectValue placeholder="Select pipeline…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="__none__">None</ZoruSelectItem>
                {pipelines.map((p) => (
                  <ZoruSelectItem key={p.id} value={p.id}>
                    {p.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              New deals will be created in this pipeline by default.
            </p>
          </div>
          <Separator />
          <ToggleRow
            label="Auto-progression"
            description="Automatically advance deals to the next stage when all tasks are complete."
            name="autoProgression"
            defaultChecked={Boolean(config.autoProgression)}
          />
        </SectionCard>
      </form>

      {/* ── Lead settings ──────────────────────────────────────── */}
      <form onSubmit={handleLeadSubmit}>
        <SectionCard
          icon={Users}
          title="Lead Settings"
          description="Auto-assign, lead scoring and default status for incoming leads."
          footer={
            <>
              <SaveFeedback state={leadState} />
              <Button type="submit" size="sm" disabled={leadPending}>
                {leadPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <ToggleRow
            label="Auto-assign leads"
            description="Round-robin assign new leads to available agents automatically."
            name="autoAssignLeads"
            defaultChecked={Boolean(config.autoAssignLeads)}
          />
          <Separator />
          <ToggleRow
            label="Lead scoring"
            description="Enable AI-assisted lead scoring based on engagement and profile data."
            name="leadScoringEnabled"
            defaultChecked={Boolean(config.leadScoringEnabled)}
          />
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="defaultStatus">Default Lead Status</Label>
            <Select
              name="defaultLeadStatusId"
              defaultValue={config.defaultLeadStatusId ?? '__none__'}
            >
              <ZoruSelectTrigger id="defaultStatus">
                <ZoruSelectValue placeholder="Select status…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="__none__">None</ZoruSelectItem>
                {leadStatuses.map((s) => (
                  <ZoruSelectItem key={s._id} value={s._id}>
                    <span className="inline-flex items-center gap-1.5">
                      {s.color ? (
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      ) : null}
                      {s.type}
                    </span>
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              Applied to every new lead created without an explicit status.
            </p>
          </div>
        </SectionCard>
      </form>

      {/* ── Deal settings ──────────────────────────────────────── */}
      <form onSubmit={handleDealSubmit}>
        <SectionCard
          icon={Boxes}
          title="Deal Settings"
          description="Probability tracking, deal rot threshold and default currency."
          footer={
            <>
              <SaveFeedback state={dealState} />
              <Button type="submit" size="sm" disabled={dealPending}>
                {dealPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <ToggleRow
            label="Probability tracking"
            description="Show win-probability percentage on each deal card and in reports."
            name="probabilityTracking"
            defaultChecked={Boolean(config.probabilityTracking)}
          />
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="dealRot">Deal rot threshold (days)</Label>
            <Input
              id="dealRot"
              name="dealRotDays"
              type="number"
              min={1}
              max={365}
              defaultValue={String(config.dealRotDays ?? 30)}
              className="w-32"
            />
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              Flag open deals as &quot;at-risk&quot; after this many days without activity.
            </p>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="currency">Default Currency</Label>
            <Select
              name="defaultCurrency"
              defaultValue={config.defaultCurrency ?? 'INR'}
            >
              <ZoruSelectTrigger id="currency" className="w-36">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CURRENCIES.map((c) => (
                  <ZoruSelectItem key={c} value={c}>
                    {c}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
        </SectionCard>
      </form>

      {/* ── Notification settings ──────────────────────────────── */}
      <form onSubmit={handleNotifSubmit}>
        <SectionCard
          icon={Bell}
          title="Notification Settings"
          description="Control how and where CRM events are delivered."
          footer={
            <>
              <SaveFeedback state={notifState} />
              <Button type="submit" size="sm" disabled={notifPending}>
                {notifPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <ToggleRow
            label="Email notifications"
            description="Send email alerts for lead assignments, deal stage changes and task reminders."
            name="emailNotifications"
            defaultChecked={Boolean(config.emailNotifications)}
          />
          <Separator />
          <ToggleRow
            label="In-app notifications"
            description="Show bell-icon alerts inside the CRM dashboard."
            name="inAppNotifications"
            defaultChecked={config.inAppNotifications !== false}
          />
        </SectionCard>
      </form>
    </div>
  );
}
