'use client';

/**
 * SabCRM — SabFlow automations (`/dashboard/settings/crm/flow-automations`).
 *
 * Binds CRM record events to SabFlow flows so automations get true branching /
 * parallel / delay / approval (vs the linear rules on the Workflows page). Each
 * row = object (or Any) + event + flow + active. A matching record event then
 * enqueues the flow on the shared SabFlow engine.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Plus, Trash2, Workflow, Save } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Switch,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmFlowBindingsTw,
  listSabcrmAutomationFlowsTw,
  saveSabcrmFlowBindingTw,
  deleteSabcrmFlowBindingTw,
} from '@/app/actions/sabcrm-flow-bindings.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { SabcrmFlowBinding } from '@/lib/sabcrm/flow-bindings.server';
import type { SabcrmWorkflowEvent } from '@/lib/rust-client/sabcrm-workflows';

interface Row extends SabcrmFlowBinding {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

const EVENTS: ReadonlyArray<{ value: SabcrmWorkflowEvent; label: string }> = [
  { value: 'record.created', label: 'Record created' },
  { value: 'record.updated', label: 'Record updated' },
  { value: 'record.deleted', label: 'Record deleted' },
  { value: 'record.stage_changed', label: 'Stage changed' },
  { value: 'record.status_changed', label: 'Status changed' },
];

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FlowAutomationsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [objects, setObjects] = React.useState<Array<{ value: string; label: string }>>([]);
  const [flows, setFlows] = React.useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [bindRes, objsRes, flowsRes] = await Promise.all([
        listSabcrmFlowBindingsTw(activeProjectId),
        listObjectsTw(activeProjectId),
        listSabcrmAutomationFlowsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (bindRes.ok) {
        setRows(bindRes.data.map((b) => ({ ...b, _key: b.id })));
      } else setError(bindRes.error);
      if (objsRes.ok) {
        setObjects(objsRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })));
      }
      if (flowsRes.ok) {
        setFlows(flowsRes.data.map((f) => ({ value: f.id, label: f.name })));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function patchRow(key: string, patch: Partial<Row>): void {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...patch, _dirty: true } : r)),
    );
  }
  function addRow(): void {
    setRows((prev) => [
      ...prev,
      {
        id: '',
        projectId: activeProjectId ?? '',
        object: '',
        event: 'record.created',
        flowId: '',
        isActive: true,
        _isNew: true,
        _dirty: true,
        _key: genKey(),
      },
    ]);
  }

  async function saveRow(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.flowId) {
      toast({ title: 'Pick a flow first.', tone: 'danger' });
      return;
    }
    setBusyKey(row._key);
    const res = await saveSabcrmFlowBindingTw(
      {
        id: row._isNew ? undefined : row.id,
        object: row.object,
        event: row.event,
        flowId: row.flowId,
        isActive: row.isActive,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r._key === row._key ? { ...res.data, _key: r._key } : r,
      ),
    );
    toast({ title: 'Automation saved', tone: 'success' });
  }

  async function removeRow(row: Row): Promise<void> {
    if (row._isNew || !row.id) {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      return;
    }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteSabcrmFlowBindingTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Automation removed', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabFlow automations</PageTitle>
          <PageDescription>
            Run a SabFlow flow when a CRM record event fires — for branching,
            parallel paths, delays and approvals beyond the linear Workflows.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={addRow}
            disabled={flows.length === 0}
          >
            Add automation
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}
      {!loading && flows.length === 0 && (
        <Alert tone="info" className="mb-[var(--st-space-3)]">
          No SabFlow flows found for this workspace yet. Create a flow in SabFlow,
          then bind it to a CRM event here.
        </Alert>
      )}

      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={Workflow}
            title="No automations yet"
            description="Bind a CRM event to a SabFlow flow to get started."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((row) => (
            <Card
              key={row._key}
              className="flex flex-wrap items-end gap-[var(--st-space-2)] p-[var(--st-space-3)]"
            >
              <Field label="When event" className="min-w-[150px] flex-1">
                <Select
                  value={row.event}
                  onValueChange={(event) =>
                    patchRow(row._key, { event: event as SabcrmWorkflowEvent })
                  }
                >
                  <SelectTrigger aria-label="Event">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENTS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="On object" className="min-w-[150px] flex-1">
                <Select
                  value={row.object || '__any__'}
                  onValueChange={(v) =>
                    patchRow(row._key, { object: v === '__any__' ? '' : v })
                  }
                >
                  <SelectTrigger aria-label="Object">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any object</SelectItem>
                    {objects.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Run flow" className="min-w-[160px] flex-1">
                <Select
                  value={row.flowId || ''}
                  onValueChange={(flowId) => patchRow(row._key, { flowId })}
                >
                  <SelectTrigger aria-label="Flow">
                    <SelectValue placeholder="Select a flow" />
                  </SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Active" className="w-[70px]">
                <Switch
                  checked={row.isActive}
                  aria-label="Active"
                  onCheckedChange={(isActive) => patchRow(row._key, { isActive })}
                />
              </Field>
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => saveRow(row)}
                disabled={busyKey === row._key || !row._dirty}
                loading={busyKey === row._key}
              >
                Save
              </Button>
              <IconButton
                icon={Trash2}
                label="Remove automation"
                variant="ghost"
                onClick={() => removeRow(row)}
                disabled={busyKey === row._key}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
