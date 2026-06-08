'use client';

import { useState, useTransition } from 'react';
import {
  Plus,
  Play,
  Trash2,
  Zap,
  CheckCircle2,
  PauseCircle,
  Clock,
  Webhook,
  PlusCircle,
  Pencil,
  Mail,
  Send,
  MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Badge,
  StatCard,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyState,
  SimpleTooltip,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createSabtablesAutomation,
  deleteSabtablesAutomation,
  runSabtablesAutomation,
} from '@/app/actions/sabtables.actions';
import type {
  SabtablesAutomationDoc,
  SabtablesTriggerKind,
} from '@/lib/rust-client/sabtables-automations';

interface Props {
  tableId: string;
  initialAutomations: SabtablesAutomationDoc[];
}

const TRIGGER_KINDS: { kind: SabtablesTriggerKind; label: string; icon: LucideIcon }[] = [
  { kind: 'record_created', label: 'When a record is created', icon: PlusCircle },
  { kind: 'record_updated', label: 'When a record is updated', icon: Pencil },
  { kind: 'cron', label: 'On a schedule', icon: Clock },
  { kind: 'webhook', label: 'When a webhook is received', icon: Webhook },
];

const ACTION_KINDS: { kind: string; label: string; icon: LucideIcon }[] = [
  { kind: 'send_email', label: 'Send email', icon: Mail },
  { kind: 'create_record', label: 'Create record', icon: PlusCircle },
  { kind: 'update_record', label: 'Update record', icon: Pencil },
  { kind: 'webhook', label: 'POST webhook', icon: Send },
  { kind: 'slack', label: 'Send Slack message', icon: MessageSquare },
];

const TRIGGER_META: Record<SabtablesTriggerKind, { label: string; icon: LucideIcon }> = {
  record_created: { label: 'Record created', icon: PlusCircle },
  record_updated: { label: 'Record updated', icon: Pencil },
  cron: { label: 'Scheduled', icon: Clock },
  webhook: { label: 'Webhook', icon: Webhook },
};

export function AutomationsBuilderClient({ tableId, initialAutomations }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState(initialAutomations);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [triggerKind, setTriggerKind] = useState<SabtablesTriggerKind>('record_created');
  const [actionKind, setActionKind] = useState('send_email');
  const [, startTransition] = useTransition();

  const enabledCount = items.filter((a) => a.isEnabled).length;
  const disabledCount = items.length - enabledCount;

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabtablesAutomation({
          tableId,
          name: name.trim(),
          trigger: { kind: triggerKind },
          actions: [{ id: `act_${Date.now()}`, kind: actionKind }],
          isEnabled: false,
        });
        setItems((prev) => [res.entity, ...prev]);
        setOpen(false);
        setName('');
        toast.success('Automation created');
      } catch (err) {
        console.error('[sabtables] createAutomation failed', err);
        toast.error('Could not create the automation. Please try again.');
      }
    });
  };

  const handleRun = (id: string) => {
    startTransition(async () => {
      try {
        await runSabtablesAutomation(id);
        toast.success('Automation queued to run');
      } catch (err) {
        console.error('[sabtables] runAutomation failed', err);
        toast.error('Could not run the automation. Please try again.');
      }
    });
  };

  const handleDelete = (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((a) => a._id !== id));
    startTransition(async () => {
      try {
        await deleteSabtablesAutomation(id);
      } catch (err) {
        console.error('[sabtables] deleteAutomation failed', err);
        setItems(previous);
        toast.error('Could not delete the automation. Please try again.');
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1000px] space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--st-text)]">
            <Zap className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
            Automations
          </h1>
          <p className="mt-1 max-w-prose text-sm text-[var(--st-text-secondary)]">
            Run actions automatically when records change, on a schedule, or when a
            webhook arrives.
          </p>
        </div>
        <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
          New automation
        </Button>
      </div>

      {items.length > 0 ? (
        <section
          aria-label="Automation summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard label="Automations" value={items.length} icon={Zap} accent="#7c3aed" />
          <StatCard
            label="Enabled"
            value={enabledCount}
            icon={CheckCircle2}
            accent="#1f9d55"
          />
          <StatCard
            label="Disabled"
            value={disabledCount}
            icon={PauseCircle}
            accent="#d4860b"
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Zap}
            title="No automations yet"
            description="Automations react to record changes, schedules, or webhooks, then run actions like sending an email or posting to a webhook."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                Create automation
              </Button>
            }
          />
        </Card>
      ) : (
        <section aria-label="Automations" className="space-y-3">
          {items.map((a) => {
            const meta = TRIGGER_META[a.trigger.kind];
            const TriggerIcon = meta?.icon ?? Zap;
            return (
              <Card key={a._id} variant="outlined" padding="md">
                <article className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                      <TriggerIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-[var(--st-text)]">
                          {a.name}
                        </span>
                        <Badge tone={a.isEnabled ? 'success' : 'neutral'} dot>
                          {a.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--st-text-secondary)]">
                        {meta?.label ?? a.trigger.kind} ·{' '}
                        <span className="tabular-nums">{a.actions.length}</span>{' '}
                        {a.actions.length === 1 ? 'action' : 'actions'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Play}
                      onClick={() => handleRun(a._id)}
                    >
                      Run now
                    </Button>
                    <SimpleTooltip label="Delete automation">
                      <IconButton
                        label={`Delete ${a.name}`}
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(a._id)}
                      />
                    </SimpleTooltip>
                  </div>
                </article>
              </Card>
            );
          })}
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New automation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Email on new lead"
                autoFocus
              />
            </Field>
            <Field label="Trigger" help="What starts this automation.">
              <Select
                value={triggerKind}
                onValueChange={(v) => setTriggerKind(v as SabtablesTriggerKind)}
              >
                <SelectTrigger aria-label="Trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_KINDS.map((t) => (
                    <SelectItem key={t.kind} value={t.kind}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="First action" help="What runs when the trigger fires.">
              <Select value={actionKind} onValueChange={setActionKind}>
                <SelectTrigger aria-label="First action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_KINDS.map((a) => (
                    <SelectItem key={a.kind} value={a.kind}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>
              Create automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
