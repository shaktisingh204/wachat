'use client';

import * as React from 'react';
import {
  Badge,
  Card,
  EmptyState,
  IconButton,
  Field,
  SelectField,
  StatCard,
  Table,
  TBody,
  Td,
  THead,
  Th,
  Tr,
  Skeleton,
  SearchInput,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Timer,
} from 'lucide-react';
import { listVoiceCallCdrs } from '@/app/actions/sabcall.actions';

type CallRow = {
  _id: string;
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  agentId?: string | null;
  queueId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSecs: number;
  status: 'completed' | 'missed' | 'abandoned' | 'voicemail' | 'failed';
  recordingFileId?: string | null;
  provider: string;
  notes?: string | null;
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const STATUS_TONE: Record<CallRow['status'], React.ComponentProps<typeof Badge>['tone']> = {
  completed: 'success',
  voicemail: 'info',
  failed: 'danger',
  missed: 'warning',
  abandoned: 'neutral',
};

export default function VoiceCallsLogPage() {
  const [data, setData] = React.useState<CallRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [directionFilter, setDirectionFilter] = React.useState('all');
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoiceCallCdrs({
        q: search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        direction: directionFilter === 'all' ? undefined : directionFilter,
      });
      if (res.success) setData(res.data as CallRow[]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, directionFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const completed = data.filter((c) => c.status === 'completed').length;
  const missed = data.filter((c) => c.status === 'missed' || c.status === 'abandoned').length;
  const inbound = data.filter((c) => c.direction === 'inbound').length;
  const totalDuration = data.reduce((s, c) => s + c.durationSecs, 0);
  const avgDuration = completed > 0 ? Math.round(totalDuration / completed) : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Call log</PageTitle>
          <PageDescription>
            Every inbound, outbound, missed, and voicemail call with playback.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section aria-label="Call metrics" className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
        <StatCard label="Completed" value={completed} icon={Phone} accent="#1f9d55" />
        <StatCard label="Missed or abandoned" value={missed} icon={PhoneMissed} accent="#e0484e" />
        <StatCard label="Inbound" value={inbound} icon={PhoneIncoming} accent="#3b7af5" />
        <StatCard label="Avg duration" value={fmtDuration(avgDuration)} icon={Timer} accent="#7c3aed" />
      </section>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-4)]">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search by number or notes"
              />
            </Field>
          </div>
          <Field label="Status">
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'completed', label: 'Completed' },
                { value: 'missed', label: 'Missed' },
                { value: 'abandoned', label: 'Abandoned' },
                { value: 'voicemail', label: 'Voicemail' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </Field>
          <Field label="Direction">
            <SelectField
              value={directionFilter}
              onChange={(v) => setDirectionFilter(v ?? 'all')}
              options={[
                { value: 'all', label: 'All directions' },
                { value: 'inbound', label: 'Inbound' },
                { value: 'outbound', label: 'Outbound' },
              ]}
            />
          </Field>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 p-[var(--st-space-4)]" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls logged"
            description="Inbound, outbound, missed, and voicemail calls appear here as they happen."
          />
        ) : (
          <Table density="compact">
            <THead>
              <Tr>
                <Th>Direction</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Started</Th>
                <Th align="right">Duration</Th>
                <Th>Status</Th>
                <Th>Recording</Th>
              </Tr>
            </THead>
            <TBody>
              {data.map((c) => (
                <Tr key={c._id}>
                  <Td>
                    {c.direction === 'inbound' ? (
                      <PhoneIncoming
                        className="h-4 w-4 text-[var(--st-text-secondary)]"
                        aria-label="Inbound"
                      />
                    ) : (
                      <PhoneOutgoing
                        className="h-4 w-4 text-[var(--st-text-secondary)]"
                        aria-label="Outbound"
                      />
                    )}
                  </Td>
                  <Td className="font-mono tabular-nums">{c.fromNumber}</Td>
                  <Td className="font-mono tabular-nums">{c.toNumber}</Td>
                  <Td className="text-xs text-[var(--st-text-secondary)] tabular-nums">
                    {fmtDate(c.startedAt)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {fmtDuration(c.durationSecs)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status]} className="capitalize">
                      {c.status}
                    </Badge>
                  </Td>
                  <Td>
                    {c.recordingFileId ? (
                      <div className="flex flex-col items-start gap-1">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={playingId === c._id ? Pause : Play}
                          label={playingId === c._id ? 'Pause recording' : 'Play recording'}
                          onClick={() => setPlayingId(playingId === c._id ? null : c._id)}
                        />
                        {playingId === c._id ? (
                          <audio src={c.recordingFileId} controls autoPlay className="mt-1">
                            <track kind="captions" />
                          </audio>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--st-text-tertiary)]">None</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </main>
  );
}
