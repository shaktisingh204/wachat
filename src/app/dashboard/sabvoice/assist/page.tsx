'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  Input,
  StatCard,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ScreenShare,
  Plus,
  ChevronRight,
  ShieldCheck,
  ServerCog,
  ListChecks,
} from 'lucide-react';
import {
  listSabassistSessions,
  type SabassistSessionStatus,
  type SabassistSessionMode,
} from '@/app/actions/sabassist.actions';

type SessionRow = {
  _id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  callId?: string | null;
  status: SabassistSessionStatus;
  mode: SabassistSessionMode;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSecs?: number | null;
  createdAt?: string;
};

function fmtDuration(secs?: number | null) {
  if (secs == null) return '—';
  const m = Math.floor(secs / 60);
  const r = secs % 60;
  return `${m}m ${r}s`;
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function statusBadge(s: SabassistSessionStatus) {
  if (s === 'active') return <Badge variant="default">Active</Badge>;
  if (s === 'scheduled') return <Badge variant="outline">Scheduled</Badge>;
  return <Badge variant="secondary">Ended</Badge>;
}

export default function SabassistSessionsListPage() {
  const [rows, setRows] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'all' | SabassistSessionStatus>('all');
  const [mode, setMode] = React.useState<'all' | SabassistSessionMode>('all');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSabassistSessions({
        q: q || undefined,
        status,
        mode: mode === 'all' ? undefined : mode,
      });
      if (res.success) setRows(res.data as SessionRow[]);
    } finally {
      setLoading(false);
    }
  }, [q, status, mode]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const kpis = React.useMemo(() => {
    const active = rows.filter((r) => r.status === 'active').length;
    const scheduled = rows.filter((r) => r.status === 'scheduled').length;
    const ended = rows.filter((r) => r.status === 'ended').length;
    return { active, scheduled, ended };
  }, [rows]);

  return (
    <EntityListShell
      title="Remote Assist"
      subtitle="SabAssist screen-share sessions — attended (PIN-gated) or unattended (registered device)."
      loading={loading}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active" value={kpis.active} icon={<ScreenShare className="h-4 w-4" />} />
        <StatCard label="Scheduled" value={kpis.scheduled} icon={<ListChecks className="h-4 w-4" />} />
        <StatCard label="Ended" value={kpis.ended} icon={<ShieldCheck className="h-4 w-4" />} />
        <Link href="/dashboard/sabvoice/assist/devices">
          <StatCard
            label="Registered devices"
            value="Manage"
            icon={<ServerCog className="h-4 w-4" />}
          />
        </Link>
      </div>

      <Card className="p-4 mb-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by customer name / email / notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="md:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger className="md:w-[160px]">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="attended">Attended</SelectItem>
            <SelectItem value="unattended">Unattended</SelectItem>
          </SelectContent>
        </Select>
        <Link href="/dashboard/sabvoice/assist/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New session
          </Button>
        </Link>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-zoru-ink-muted">
          No SabAssist sessions yet. Start one from{' '}
          <Link className="text-zoru-brand" href="/dashboard/sabvoice/assist/new">
            New session
          </Link>
          .
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <Link
              key={s._id}
              href={`/dashboard/sabvoice/assist/${s._id}`}
              className="group"
            >
              <Card className="p-4 flex items-center gap-4 hover:border-zoru-brand transition-colors">
                <div className="w-10 h-10 rounded-lg bg-zoru-surface-2 flex items-center justify-center text-zoru-brand">
                  <ScreenShare className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {s.customerName || s.customerEmail || 'Unnamed customer'}
                    </span>
                    {statusBadge(s.status)}
                    <Badge variant="outline">{s.mode}</Badge>
                    {s.callId && (
                      <Badge variant="outline">linked to call</Badge>
                    )}
                  </div>
                  <div className="text-xs text-zoru-ink-muted mt-1">
                    Started {fmtWhen(s.startedAt)} · Duration {fmtDuration(s.durationSecs)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zoru-ink-muted group-hover:text-zoru-brand" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
