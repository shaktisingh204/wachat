'use client';

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatCard,
} from '@/components/zoruui';
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
        <StatCard label="Completed" value={completed} icon={<Phone className="h-4 w-4" />} />
        <StatCard
          label="Missed/Abandoned"
          value={missed}
          icon={<PhoneMissed className="h-4 w-4" />}
        />
        <StatCard
          label="Inbound"
          value={inbound}
          icon={<PhoneIncoming className="h-4 w-4" />}
        />
        <StatCard
          label="Avg Duration"
          value={fmtDuration(avgDuration)}
          icon={<Phone className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <Label className="text-xs mb-1 block">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
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
            <SelectTrigger className="w-36">
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
        <table className="w-full text-sm">
          <thead className="border-b border-zoru-line">
            <tr className="text-left text-xs uppercase text-zoru-ink-muted">
              <th className="px-3 py-2">Direction</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Recording</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c._id} className="border-b border-zoru-line/50">
                <td className="px-3 py-2">
                  {c.direction === 'inbound' ? (
                    <PhoneIncoming className="h-4 w-4 text-zoru-ink" />
                  ) : (
                    <PhoneOutgoing className="h-4 w-4 text-zoru-ink" />
                  )}
                </td>
                <td className="px-3 py-2 font-mono">{c.fromNumber}</td>
                <td className="px-3 py-2 font-mono">{c.toNumber}</td>
                <td className="px-3 py-2 text-xs text-zoru-ink-muted">
                  {fmtDate(c.startedAt)}
                </td>
                <td className="px-3 py-2">{fmtDuration(c.durationSecs)}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      c.status === 'completed'
                        ? 'default'
                        : c.status === 'voicemail'
                          ? 'secondary'
                          : c.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                    }
                    className="capitalize"
                  >
                    {c.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {c.recordingFileId ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setPlayingId(playingId === c._id ? null : c._id)
                      }
                    >
                      {playingId === c._id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-zoru-ink-muted">—</span>
                  )}
                  {playingId === c._id && c.recordingFileId && (
                    <audio src={c.recordingFileId} controls autoPlay className="mt-1" />
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zoru-ink-muted">
                  No calls logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </EntityListShell>
  );
}
