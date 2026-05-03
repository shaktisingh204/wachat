'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CalendarClock,
  Plus,
  Check,
  X,
  Send,
  Eye,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getWeeklyTimesheets,
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

type StatusTone = 'neutral' | 'amber' | 'green' | 'red';

const STATUS_TONE: Record<WsWeeklyTimesheetStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try { return format(new Date(v as any), 'dd MMM yyyy'); } catch { return '—'; }
}

function fmtHours(h: number, m: number): string {
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function WeeklyTimesheetsPage() {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<WsWeeklyTimesheet[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<WsWeeklyTimesheetStatus | 'all'>('all');
  const [isLoading, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const [rows, emps] = await Promise.all([getWeeklyTimesheets(), getCrmEmployees()]);
      setSheets(rows);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          name: [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.email || 'Unnamed',
        })),
      );
    });
  };

  useEffect(() => { load(); }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e._id, e.name);
    return m;
  }, [employees]);

  const filtered = statusFilter === 'all' ? sheets : sheets.filter((s) => s.status === statusFilter);

  const handleSubmit = (id?: string) => {
    if (!id) return;
    startTransition(async () => {
      const r = await submitWeeklyTimesheet(id);
      if (r.ok) { toast({ title: 'Submitted' }); load(); }
      else { toast({ title: 'Error', description: (r as any).error, variant: 'destructive' }); }
    });
  };

  const handleApprove = (id?: string) => {
    if (!id) return;
    startTransition(async () => {
      const r = await approveWeeklyTimesheet(id);
      if (r.ok) { toast({ title: 'Approved' }); load(); }
      else { toast({ title: 'Error', description: (r as any).error, variant: 'destructive' }); }
    });
  };

  const handleReject = (id?: string) => {
    if (!id) return;
    const reason = window.prompt('Reason for rejection?') ?? '';
    startTransition(async () => {
      const r = await rejectWeeklyTimesheet(id, reason);
      if (r.ok) { toast({ title: 'Rejected' }); load(); }
      else { toast({ title: 'Error', description: (r as any).error, variant: 'destructive' }); }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Weekly Timesheets"
        subtitle="Track, submit, and approve weekly hour logs across your team."
        icon={CalendarClock}
        actions={
          <Link href="/dashboard/hrm/payroll/weekly-timesheets/new">
            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
              New Timesheet
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">All Timesheets</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {filtered.length} timesheet{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg border-border bg-card text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Employee</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Week Start</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Week End</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Total Hours</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">No timesheets found.</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={String(s._id)} className="border-t border-border hover:bg-secondary/50">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {empMap.get(String(s.user_id)) || `…${String(s.user_id).slice(-6)}`}
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{fmtDate(s.week_start_date)}</td>
                    <td className="px-4 py-2.5 text-foreground">{fmtDate(s.week_end_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-foreground">{fmtHours(s.total_hours, s.total_minutes)}</td>
                    <td className="px-4 py-2.5">
                      <ClayBadge tone={STATUS_TONE[s.status]} dot>{s.status}</ClayBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/hrm/payroll/weekly-timesheets/${s._id}`}>
                          <ClayButton variant="pill" size="sm" title="View detail">
                            <Eye className="h-3.5 w-3.5" />
                          </ClayButton>
                        </Link>
                        {s.status === 'draft' && (
                          <ClayButton variant="pill" size="sm" onClick={() => handleSubmit(s._id)} title="Submit for approval">
                            <Send className="h-3.5 w-3.5" />
                          </ClayButton>
                        )}
                        {s.status === 'submitted' && (
                          <>
                            <ClayButton variant="pill" size="sm" onClick={() => handleApprove(s._id)} title="Approve">
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            </ClayButton>
                            <ClayButton variant="pill" size="sm" onClick={() => handleReject(s._id)} title="Reject">
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </ClayButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
