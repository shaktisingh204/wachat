'use client';

import * as React from 'react';
import {
  Badge,
  Card,
  EmptyState,
  IconButton,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
} from 'lucide-react';
import { listVoiceCallCdrs } from '@/app/actions/sabvoice.actions';

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
    <EntityListShell
      title="Call Log"
      subtitle="Every inbound, outbound, missed and voicemail call."
      search={{ value: search, onChange: setSearch, placeholder: 'Search by number or notes...' }}
      loading={loading}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Completed" value={completed} icon={Phone} />
        <StatCard label="Missed/Abandoned" value={missed} icon={PhoneMissed} />
        <StatCard label="Inbound" value={inbound} icon={PhoneIncoming} />
        <StatCard label="Avg Duration" value={fmtDuration(avgDuration)} icon={Phone} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <Label className="text-xs mb-1 block">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Direction</Label>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls logged"
            description="Inbound, outbound, missed and voicemail calls will appear here once they happen."
          />
        ) : (
          <Table density="compact">
            <THead>
              <Tr>
                <Th>Direction</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th>Recording</Th>
              </Tr>
            </THead>
            <TBody>
              {data.map((c) => (
                <Tr key={c._id}>
                  <Td>
                    {c.direction === 'inbound' ? (
                      <PhoneIncoming className="h-4 w-4 text-[var(--st-text)]" aria-label="Inbound" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-[var(--st-text)]" aria-label="Outbound" />
                    )}
                  </Td>
                  <Td className="font-mono">{c.fromNumber}</Td>
                  <Td className="font-mono">{c.toNumber}</Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">{fmtDate(c.startedAt)}</Td>
                  <Td>{fmtDuration(c.durationSecs)}</Td>
                  <Td>
                    <Badge
                      tone={
                        c.status === 'completed'
                          ? 'success'
                          : c.status === 'voicemail'
                            ? 'info'
                            : c.status === 'failed'
                              ? 'danger'
                              : 'neutral'
                      }
                      className="capitalize"
                    >
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
                          <audio src={c.recordingFileId} controls autoPlay className="mt-1" />
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--st-text-secondary)]">-</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </EntityListShell>
  );
}
