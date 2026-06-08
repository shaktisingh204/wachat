'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  StatCard,
  SelectField,
  SearchInput,
  Field,
  EmptyState,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
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
  if (secs == null) return 'n/a';
  const m = Math.floor(secs / 60);
  const r = secs % 60;
  return `${m}m ${r}s`;
}

function fmtWhen(iso?: string | null) {
  if (!iso) return 'not started';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const STATUS_TONE: Record<SabassistSessionStatus, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  scheduled: 'info',
  ended: 'neutral',
};

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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabVoice</PageEyebrow>
          <PageTitle>Remote assist</PageTitle>
          <PageDescription>
            SabAssist screen-share sessions, attended (PIN-gated) or unattended (registered device).
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/sabvoice/assist/devices">
              <ServerCog className="h-4 w-4" aria-hidden="true" />
              Devices
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/dashboard/sabvoice/assist/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New session
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Session metrics" className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
        <StatCard label="Active" value={kpis.active} icon={ScreenShare} accent="#1f9d55" />
        <StatCard label="Scheduled" value={kpis.scheduled} icon={ListChecks} accent="#3b7af5" />
        <StatCard label="Ended" value={kpis.ended} icon={ShieldCheck} accent="#64748b" />
      </section>

      <div className="flex flex-wrap items-end gap-[var(--st-space-3)]">
        <div className="min-w-[220px] flex-1">
          <Field label="Search">
            <SearchInput value={q} onValueChange={setQ} placeholder="Search by customer name, email, or notes" />
          </Field>
        </div>
        <Field label="Status">
          <SelectField
            value={status}
            onChange={(v) => setStatus((v as typeof status) ?? 'all')}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'active', label: 'Active' },
              { value: 'ended', label: 'Ended' },
            ]}
          />
        </Field>
        <Field label="Mode">
          <SelectField
            value={mode}
            onChange={(v) => setMode((v as typeof mode) ?? 'all')}
            options={[
              { value: 'all', label: 'All modes' },
              { value: 'attended', label: 'Attended' },
              { value: 'unattended', label: 'Unattended' },
            ]}
          />
        </Field>
      </div>

      {loading ? (
        <div className="flex flex-col gap-[var(--st-space-3)]" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={ScreenShare}
            title="No sessions yet"
            description="Start a screen-share session to help a customer in real time."
            action={
              <Button asChild variant="primary">
                <Link href="/dashboard/sabvoice/assist/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New session
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          {rows.map((s) => (
            <Link key={s._id} href={`/dashboard/sabvoice/assist/${s._id}`} className="group block focus:outline-none">
              <Card
                variant="interactive"
                className="flex items-center gap-4 group-focus-visible:ring-2 group-focus-visible:ring-[var(--st-accent)]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                  style={{ background: '#0d94881a', color: '#0d9488' }}
                >
                  <ScreenShare className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-[var(--st-text)]">
                      {s.customerName || s.customerEmail || 'Unnamed customer'}
                    </span>
                    <Badge tone={STATUS_TONE[s.status]} className="capitalize">
                      {s.status}
                    </Badge>
                    <Badge tone="neutral" kind="outline" className="capitalize">
                      {s.mode}
                    </Badge>
                    {s.callId ? (
                      <Badge tone="info" kind="outline">
                        linked to call
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-[var(--st-text-secondary)]">
                    Started {fmtWhen(s.startedAt)} · Duration {fmtDuration(s.durationSecs)}
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-[var(--st-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--st-accent)]"
                  aria-hidden="true"
                />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
