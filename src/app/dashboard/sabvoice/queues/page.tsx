'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Badge,
  Card,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatCard,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Plus, Edit2, Trash2, Users, Layers } from 'lucide-react';
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

export default function VoiceQueuesPage() {
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
      void load();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Archive this queue?')) return;
    await deleteVoiceQueue(id);
    void load();
  };

  const activeQueues = data.filter((q) => q.status === 'active').length;
  const totalAgents = data.reduce((s, q) => s + q.agentIds.length, 0);

  return (
    <>
      <EntityListShell
        title="Call Queues"
        subtitle="Distribute incoming calls across agents."
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Queue
          </Button>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search queues...' }}
        loading={loading}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <StatCard
            label="Active Queues"
            value={activeQueues}
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            label="Total Agent Assignments"
            value={totalAgents}
            icon={<Users className="h-4 w-4" />}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((q) => (
            <Card key={q._id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{q.name}</span>
                <Badge variant={q.status === 'active' ? 'default' : 'outline'}>
                  {q.status}
                </Badge>
              </div>
              {q.description && (
                <p className="text-sm text-zoru-ink-muted">{q.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-zoru-ink-muted">
                <div>Strategy: <span className="text-zoru-ink">{q.strategy}</span></div>
                <div>Wait: <span className="text-zoru-ink">{q.maxWaitSecs}s</span></div>
                <div>Agents: <span className="text-zoru-ink">{q.agentIds.length}</span></div>
                <div>Fallback: <span className="text-zoru-ink">{q.fallback ?? '—'}</span></div>
              </div>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(q)}>
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500"
                  onClick={() => remove(q._id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </EntityListShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Queue' : 'New Queue'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Strategy</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as never)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="least_busy">Least Busy</SelectItem>
                    <SelectItem value="simultaneous">Simultaneous Ring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Max Wait (s)</Label>
                <Input
                  type="number"
                  value={maxWait}
                  onChange={(e) => setMaxWait(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Agent IDs (comma-separated)</Label>
              <Textarea
                rows={2}
                value={agentIdsCsv}
                onChange={(e) => setAgentIdsCsv(e.target.value)}
                placeholder="60d5f...a1, 60d5f...b2"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Fallback</Label>
              <Select value={fallback} onValueChange={setFallback}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="hangup">Hangup</SelectItem>
                  <SelectItem value="forward">Forward</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Hold Music (audio)</Label>
              <SabFilePickerButton
                accept="audio"
                onPick={(p) => setHoldMusicFileId(p.url)}
              >
                {holdMusicFileId ? 'Change Audio' : 'Pick from SabFiles'}
              </SabFilePickerButton>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={submitting || !name.trim()}>
              {submitting ? 'Saving...' : 'Save Queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
