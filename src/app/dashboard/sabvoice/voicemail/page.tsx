'use client';

import * as React from 'react';
import {
  Button,
  Badge,
  Card,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatCard,
} from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Voicemail, Play, Check, Archive, MessageSquare } from 'lucide-react';
import {
  listVoicemails,
  markVoicemailListened,
  deleteVoicemail,
} from '@/app/actions/sabvoice.actions';

type VmRow = {
  _id: string;
  callId: string;
  fromNumber: string;
  toNumber?: string | null;
  audioFileId: string;
  durationSecs?: number | null;
  transcript?: string | null;
  listenedBy: string[];
  status: 'new' | 'listened' | 'archived';
  createdAt: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function VoicemailInboxPage() {
  const [data, setData] = React.useState<VmRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('new');
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoicemails({ q: search, status: statusFilter });
      if (res.success) setData(res.data as VmRow[]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleListen = async (id: string) => {
    setActiveId(id);
    await markVoicemailListened(id);
    void load();
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this voicemail?')) return;
    await deleteVoicemail(id);
    void load();
  };

  const newCount = data.filter((v) => v.status === 'new').length;
  const listenedCount = data.filter((v) => v.status === 'listened').length;

  return (
    <EntityListShell
      title="Voicemail Inbox"
      subtitle="Listen, transcribe, and triage missed-call voicemails."
      search={{ value: search, onChange: setSearch, placeholder: 'Search voicemails...' }}
      loading={loading}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="New"
          value={newCount}
          icon={<Voicemail className="h-4 w-4" />}
        />
        <StatCard
          label="Listened"
          value={listenedCount}
          icon={<Check className="h-4 w-4" />}
        />
        <StatCard
          label="Total"
          value={data.length}
          icon={<MessageSquare className="h-4 w-4" />}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="listened">Listened</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((v) => (
          <Card key={v._id} className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Voicemail className="h-4 w-4 text-[var(--st-accent)]" />
                <span className="font-mono">{v.fromNumber}</span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  {fmtDate(v.createdAt)}
                </span>
              </div>
              <Badge
                variant={
                  v.status === 'new'
                    ? 'destructive'
                    : v.status === 'listened'
                      ? 'default'
                      : 'outline'
                }
              >
                {v.status}
              </Badge>
            </div>
            {activeId === v._id && (
              <audio src={v.audioFileId} controls autoPlay className="w-full" />
            )}
            {v.transcript && (
              <div className="text-sm bg-[var(--st-bg-muted)] rounded p-2 text-[var(--st-text-secondary)] italic">
                "{v.transcript}"
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleListen(v._id)}>
                <Play className="h-3 w-3 mr-1" /> Listen
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[var(--st-text)]"
                onClick={() => handleArchive(v._id)}
              >
                <Archive className="h-3 w-3 mr-1" /> Archive
              </Button>
            </div>
          </Card>
        ))}
        {data.length === 0 && (
          <Card className="p-8 text-center text-[var(--st-text-secondary)]">
            No voicemails in this view.
          </Card>
        )}
      </div>
    </EntityListShell>
  );
}
