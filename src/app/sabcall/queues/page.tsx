'use client';

import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Field,
  Badge,
  Card,
  Textarea,
  SelectField,
  StatCard,
  EmptyState,
  Skeleton,
  SearchInput,
  useToast,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { Plus, Edit2, Trash2, Users, Layers, Clock, Shuffle } from 'lucide-react';
import {
  listVoiceQueues,
  createVoiceQueue,
  updateVoiceQueue,
  deleteVoiceQueue,
} from '@/app/actions/sabvoice.actions';

type QueueRow = {
  _id: string;
  name: string;
  description?: string | null;
  strategy: 'round_robin' | 'least_busy' | 'simultaneous';
  agentIds: string[];
  maxWaitSecs: number;
  fallback?: string | null;
  holdMusicFileId?: string | null;
  status: 'active' | 'archived';
};

const STRATEGY_LABEL: Record<QueueRow['strategy'], string> = {
  round_robin: 'Round robin',
  least_busy: 'Least busy',
  simultaneous: 'Ring all',
};

export default function VoiceQueuesPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<QueueRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  const [editing, setEditing] = React.useState<QueueRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [strategy, setStrategy] =
    React.useState<'round_robin' | 'least_busy' | 'simultaneous'>('round_robin');
  const [maxWait, setMaxWait] = React.useState(60);
  const [fallback, setFallback] = React.useState('voicemail');
  const [agentIdsCsv, setAgentIdsCsv] = React.useState('');
  const [holdMusicFileId, setHoldMusicFileId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoiceQueues({ q: search });
      if (res.success) setData(res.data as QueueRow[]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setStrategy('round_robin');
    setMaxWait(60);
    setFallback('voicemail');
    setAgentIdsCsv('');
    setHoldMusicFileId(null);
    setOpen(true);
  };

  const openEdit = (q: QueueRow) => {
    setEditing(q);
    setName(q.name);
    setDescription(q.description ?? '');
    setStrategy(q.strategy);
    setMaxWait(q.maxWaitSecs);
    setFallback(q.fallback ?? 'voicemail');
    setAgentIdsCsv(q.agentIds.join(', '));
    setHoldMusicFileId(q.holdMusicFileId ?? null);
    setOpen(true);
  };

  const save = async () => {
    setSubmitting(true);
    try {
      const agentIds = agentIdsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name,
        description,
        strategy,
        maxWaitSecs: Number(maxWait) || 60,
        fallback,
        agentIds,
        holdMusicFileId: holdMusicFileId ?? undefined,
      };
      if (editing) {
        await updateVoiceQueue(editing._id, payload);
      } else {
        await createVoiceQueue(payload);
      }
      setOpen(false);
      toast.success(editing ? 'Queue updated' : 'Queue created');
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteVoiceQueue(id);
      toast.success('Queue archived');
      void load();
    } catch (e) {
      toast.error(`Archive failed: ${(e as Error).message}`);
    }
  };

  const activeQueues = data.filter((q) => q.status === 'active').length;
  const totalAgents = data.reduce((s, q) => s + q.agentIds.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabVoice</PageEyebrow>
          <PageTitle>Call queues</PageTitle>
          <PageDescription>Distribute incoming calls across your agents.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New queue
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Queue metrics" className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2">
        <StatCard label="Active queues" value={activeQueues} icon={Layers} accent="#1f9d55" />
        <StatCard label="Agent assignments" value={totalAgents} icon={Users} accent="#3b7af5" />
      </section>

      <div className="max-w-sm">
        <Field label="Search">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Search queues" />
        </Field>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Layers}
            title="No queues yet"
            description="Create a queue to route inbound calls to the right group of agents."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                New queue
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2">
          {data.map((q) => (
            <Card key={q._id} variant="outlined" className="flex flex-col gap-[var(--st-space-2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)]"
                    style={{ background: '#1f9d551a', color: '#1f9d55' }}
                  >
                    <Layers className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-[var(--st-text)]">{q.name}</span>
                </div>
                <Badge tone={q.status === 'active' ? 'success' : 'neutral'} className="capitalize">
                  {q.status}
                </Badge>
              </div>
              {q.description ? (
                <p className="text-sm text-[var(--st-text-secondary)]">{q.description}</p>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--st-text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <Shuffle className="h-3 w-3" aria-hidden="true" />
                  <dt className="sr-only">Strategy</dt>
                  <dd className="text-[var(--st-text)]">{STRATEGY_LABEL[q.strategy]}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <dt className="sr-only">Max wait</dt>
                  <dd className="tabular-nums text-[var(--st-text)]">{q.maxWaitSecs}s wait</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <dt className="sr-only">Agents</dt>
                  <dd className="tabular-nums text-[var(--st-text)]">{q.agentIds.length} agents</dd>
                </div>
                <div>
                  <dt className="inline">Fallback: </dt>
                  <dd className="inline capitalize text-[var(--st-text)]">{q.fallback ?? 'none'}</dd>
                </div>
              </dl>
              <div className="mt-auto flex gap-2 pt-1">
                <Button size="sm" variant="outline" iconLeft={Edit2} onClick={() => openEdit(q)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" iconLeft={Trash2} onClick={() => remove(q._id)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit queue' : 'New queue'}
        description="Set the routing strategy and assign agents to this queue."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={submitting} disabled={submitting || !name.trim()}>
              {editing ? 'Save queue' : 'Create queue'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales line" />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Strategy">
              <SelectField
                value={strategy}
                onChange={(v) => setStrategy((v as QueueRow['strategy']) ?? 'round_robin')}
                options={[
                  { value: 'round_robin', label: 'Round robin' },
                  { value: 'least_busy', label: 'Least busy' },
                  { value: 'simultaneous', label: 'Ring all' },
                ]}
              />
            </Field>
            <Field label="Max wait (seconds)">
              <Input
                type="number"
                value={maxWait}
                onChange={(e) => setMaxWait(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Agent IDs" help="Comma-separated user IDs.">
            <Textarea
              rows={2}
              value={agentIdsCsv}
              onChange={(e) => setAgentIdsCsv(e.target.value)}
              placeholder="60d5f...a1, 60d5f...b2"
            />
          </Field>
          <Field label="Fallback">
            <SelectField
              value={fallback}
              onChange={(v) => setFallback(v ?? 'voicemail')}
              options={[
                { value: 'voicemail', label: 'Voicemail' },
                { value: 'hangup', label: 'Hang up' },
                { value: 'forward', label: 'Forward' },
              ]}
            />
          </Field>
          <Field label="Hold music">
            <SabFilePickerButton accept="audio" onPick={(p) => setHoldMusicFileId(p.url)}>
              {holdMusicFileId ? 'Change audio' : 'Pick from SabFiles'}
            </SabFilePickerButton>
          </Field>
        </div>
      </Modal>
    </main>
  );
}
