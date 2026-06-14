'use client';

import { useMemo, useState, useTransition } from 'react';
import { Bell, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  checkAlertsAction,
  createAlertAction,
  deleteAlertAction,
  setAlertStatusAction,
  type AlertCheck,
} from '@/app/actions/sabbi-alerts.actions';
import type { AlertCondition, SabbiAlert } from '@/lib/sabbi/alerts.server';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';

const CONDITIONS: AlertCondition[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'];
const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

export function AlertsView({ alerts, models }: { alerts: SabbiAlert[]; models: BiModelDoc[] }) {
  const [checking, startCheck] = useTransition();
  const [checks, setChecks] = useState<AlertCheck[]>([]);

  // Create dialog.
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState(models[0]?._id ?? '');
  const [measure, setMeasure] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('gt');
  const [threshold, setThreshold] = useState('0');
  const [recipients, setRecipients] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creating, startCreate] = useTransition();
  const modelDoc = useMemo(() => models.find((m) => m._id === modelId), [models, modelId]);

  function create() {
    startCreate(async () => {
      await createAlertAction({
        name,
        modelId,
        measure: measure || modelDoc?.measures?.[0]?.key || '',
        condition,
        threshold: Number(threshold) || 0,
        recipients: recipients.split(',').map((r) => r.trim()).filter(Boolean),
        webhookUrl: webhookUrl.trim() || undefined,
      });
      setOpen(false);
      setName('');
      setRecipients('');
      setWebhookUrl('');
      window.location.reload();
    });
  }

  function runCheck() {
    startCheck(async () => {
      const res = await checkAlertsAction();
      setChecks(res);
    });
  }

  const checkById = useMemo(() => new Map(checks.map((c) => [c.id, c])), [checks]);

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <Bell size={20} aria-hidden="true" /> Alerts
          </PageTitle>
          <PageDescription>
            Watch a measure and get notified by email + a SabFlow webhook when it
            crosses a threshold.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" onClick={runCheck} disabled={checking || alerts.length === 0}>
            <RefreshCw size={16} aria-hidden="true" /> {checking ? 'Checking…' : 'Check now'}
          </Button>
          <Button onClick={() => setOpen(true)} disabled={models.length === 0}>
            <Bell size={16} aria-hidden="true" /> New alert
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={16} aria-hidden="true" /> Your alerts
          </CardTitle>
        </CardHeader>
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              tone="info"
              title="No alerts yet"
              description={models.length === 0 ? 'Connect a model first.' : 'Create an alert to watch a measure.'}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Condition</Th>
                  <Th align="left">Last value</Th>
                  <Th align="left">Status</Th>
                  <Th align="right" />
                </Tr>
              </THead>
              <TBody>
                {alerts.map((a) => {
                  const c = checkById.get(a._id);
                  return (
                    <Tr key={a._id}>
                      <Td className="font-medium">{a.name}</Td>
                      <Td className="font-mono text-xs">
                        {a.measure} {a.condition} {a.threshold}
                      </Td>
                      <Td>
                        {c?.error ? (
                          <span className="text-[var(--st-danger)]">{c.error}</span>
                        ) : c ? (
                          <Badge tone={c.triggered ? 'danger' : 'success'}>
                            {c.value?.toLocaleString()} {c.triggered ? '· fired' : '· ok'}
                          </Badge>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">
                            {a.lastValue != null ? a.lastValue.toLocaleString() : '—'}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>{a.status}</Badge>
                      </Td>
                      <Td align="right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Toggle status"
                          onClick={async () => {
                            await setAlertStatusAction(a._id, a.status === 'active' ? 'paused' : 'active');
                            window.location.reload();
                          }}
                        >
                          {a.status === 'active' ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={async () => {
                            await deleteAlertAction(a._id);
                            window.location.reload();
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New alert</DialogTitle>
            <DialogDescription>Fires when the measure crosses the threshold.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="a-name">Name</Label>
              <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Revenue dropped" />
            </div>
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <select className={selectCls} value={modelId} onChange={(e) => { setModelId(e.target.value); setMeasure(''); }}>
                {models.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="grid flex-1 gap-1.5">
                <Label>Measure</Label>
                <select className={selectCls} value={measure || modelDoc?.measures?.[0]?.key || ''} onChange={(e) => setMeasure(e.target.value)}>
                  {(modelDoc?.measures ?? []).map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid w-24 gap-1.5">
                <Label>Condition</Label>
                <select className={selectCls} value={condition} onChange={(e) => setCondition(e.target.value as AlertCondition)}>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid w-28 gap-1.5">
                <Label>Threshold</Label>
                <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-rcpt">Email recipients (comma-separated)</Label>
              <Input id="a-rcpt" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="ops@acme.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-wh">SabFlow webhook URL (optional)</Label>
              <Input id="a-wh" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://…/webhook/…" className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating || !modelId}>{creating ? 'Creating…' : 'Create alert'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
