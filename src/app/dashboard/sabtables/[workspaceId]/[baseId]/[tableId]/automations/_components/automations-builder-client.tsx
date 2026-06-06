'use client';

import { useState, useTransition } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';

import {
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
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

const TRIGGER_KINDS: { kind: SabtablesTriggerKind; label: string }[] = [
  { kind: 'record_created', label: 'When a record is created' },
  { kind: 'record_updated', label: 'When a record is updated' },
  { kind: 'cron', label: 'On a schedule' },
  { kind: 'webhook', label: 'When a webhook is received' },
];

const ACTION_KINDS = [
  { kind: 'send_email', label: 'Send email' },
  { kind: 'create_record', label: 'Create record' },
  { kind: 'update_record', label: 'Update record' },
  { kind: 'webhook', label: 'POST webhook' },
  { kind: 'slack', label: 'Send Slack message' },
];

export function AutomationsBuilderClient({ tableId, initialAutomations }: Props) {
  const [items, setItems] = useState(initialAutomations);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [triggerKind, setTriggerKind] = useState<SabtablesTriggerKind>('record_created');
  const [actionKind, setActionKind] = useState('send_email');
  const [, startTransition] = useTransition();

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
      } catch (err) {
        console.error('[sabtables] createAutomation failed', err);
      }
    });
  };

  const handleRun = (id: string) => {
    startTransition(async () => {
      try {
        await runSabtablesAutomation(id);
      } catch (err) {
        console.error('[sabtables] runAutomation failed', err);
      }
    });
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((a) => a._id !== id));
    startTransition(async () => {
      try {
        await deleteSabtablesAutomation(id);
      } catch (err) {
        console.error('[sabtables] deleteAutomation failed', err);
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Automations</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New automation
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No automations"
          description="Automations let you react to record changes, schedules, or webhooks."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create automation
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-sm text-zoru-ink-muted">
                  Trigger: <code>{a.trigger.kind}</code> · {a.actions.length} action(s) ·{' '}
                  {a.isEnabled ? 'enabled' : 'disabled'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleRun(a._id)}>
                  <Play className="w-4 h-4 mr-1" /> Run now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(a._id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New automation</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="auto-name">Name</Label>
              <Input
                id="auto-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select
                value={triggerKind}
                onValueChange={(v) => setTriggerKind(v as SabtablesTriggerKind)}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {TRIGGER_KINDS.map((t) => (
                    <ZoruSelectItem key={t.kind} value={t.kind}>
                      {t.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label>First action</Label>
              <Select value={actionKind} onValueChange={setActionKind}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {ACTION_KINDS.map((a) => (
                    <ZoruSelectItem key={a.kind} value={a.kind}>
                      {a.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
