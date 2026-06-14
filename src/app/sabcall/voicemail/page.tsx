'use client';

import * as React from 'react';
import {
  Button,
  Badge,
  Card,
  SelectField,
  StatCard,
  EmptyState,
  Skeleton,
  SearchInput,
  Field,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
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

const STATUS_TONE: Record<VmRow['status'], React.ComponentProps<typeof Badge>['tone']> = {
  new: 'accent',
  listened: 'success',
  archived: 'neutral',
};

export default function VoicemailInboxPage() {
  const { toast } = useToast();
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
    try {
      await deleteVoicemail(id);
      toast.success('Voicemail archived');
      void load();
    } catch (e) {
      toast.error(`Archive failed: ${(e as Error).message}`);
    }
  };

  const newCount = data.filter((v) => v.status === 'new').length;
  const listenedCount = data.filter((v) => v.status === 'listened').length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabVoice</PageEyebrow>
          <PageTitle>Voicemail</PageTitle>
          <PageDescription>Listen, read transcripts, and triage missed-call voicemails.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section aria-label="Voicemail metrics" className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-3">
        <StatCard label="New" value={newCount} icon={Voicemail} accent="#3b7af5" />
        <StatCard label="Listened" value={listenedCount} icon={Check} accent="#1f9d55" />
        <StatCard label="Total" value={data.length} icon={MessageSquare} accent="#7c3aed" />
      </section>

      <div className="flex flex-wrap items-end gap-[var(--st-space-3)]">
        <div className="min-w-[220px] flex-1">
          <Field label="Search">
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search voicemails" />
          </Field>
        </div>
        <Field label="Status">
          <SelectField
            value={statusFilter}
            onChange={(v) => setStatusFilter(v ?? 'new')}
            options={[
              { value: 'new', label: 'New' },
              { value: 'listened', label: 'Listened' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'All' },
            ]}
          />
        </Field>
      </div>

      {loading ? (
        <div className="flex flex-col gap-[var(--st-space-3)]" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Voicemail}
            title="Inbox is clear"
            description="No voicemails in this view. New messages land here when a caller leaves one."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          {data.map((v) => (
            <Card key={v._id} variant="outlined" className="flex flex-col gap-[var(--st-space-2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)]"
                    style={{ background: '#3b7af51a', color: '#3b7af5' }}
                  >
                    <Voicemail className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono tabular-nums text-[var(--st-text)]">{v.fromNumber}</span>
                  <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                    {fmtDate(v.createdAt)}
                  </span>
                </div>
                <Badge tone={STATUS_TONE[v.status]} className="capitalize">
                  {v.status}
                </Badge>
              </div>
              {activeId === v._id ? (
                <audio src={v.audioFileId} controls autoPlay className="w-full">
                  <track kind="captions" />
                </audio>
              ) : null}
              {v.transcript ? (
                <blockquote className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-2 text-sm italic text-[var(--st-text-secondary)]">
                  &ldquo;{v.transcript}&rdquo;
                </blockquote>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" iconLeft={Play} onClick={() => handleListen(v._id)}>
                  Listen
                </Button>
                <Button size="sm" variant="ghost" iconLeft={Archive} onClick={() => handleArchive(v._id)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
