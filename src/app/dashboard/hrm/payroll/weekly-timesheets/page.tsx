'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Plus,
  Check,
  X,
  Send,
  Eye,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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

type StatusVariant = 'secondary' | 'warning' | 'success' | 'danger';

const STATUS_VARIANT: Record<WsWeeklyTimesheetStatus, StatusVariant> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try { return format(new Date(v as any), 'dd MMM yyyy'); } catch { return '—'; }
}

function fmtHours(h: number, m: number): string {
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function WeeklyTimesheetsPage() {
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Weekly Timesheets"
      subtitle="Track, submit, and approve weekly hour logs across your team."
      primaryAction={
        <Link href="/dashboard/hrm/payroll/weekly-timesheets/new">
          <ZoruButton>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New Timesheet
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">All Timesheets</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {filtered.length} timesheet{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <EnumFilterField
            enumName="timesheetStatus"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            allLabel="All statuses"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Employee</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Week Start</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Week End</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Total Hours</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">No timesheets found.</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={String(s._id)} className="border-t border-zoru-line hover:bg-zoru-surface-2/50">
                    <td className="px-4 py-2.5 font-medium text-zoru-ink">
                      {empMap.get(String(s.user_id)) || `…${String(s.user_id).slice(-6)}`}
                    </td>
                    <td className="px-4 py-2.5 text-zoru-ink">{fmtDate(s.week_start_date)}</td>
                    <td className="px-4 py-2.5 text-zoru-ink">{fmtDate(s.week_end_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-zoru-ink">{fmtHours(s.total_hours, s.total_minutes)}</td>
                    <td className="px-4 py-2.5">
                      <ZoruBadge variant={STATUS_VARIANT[s.status]}>{s.status}</ZoruBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/hrm/payroll/weekly-timesheets/${s._id}`}>
                          <ZoruButton variant="outline" size="sm" title="View detail">
                            <Eye className="h-3.5 w-3.5" />
                          </ZoruButton>
                        </Link>
                        {s.status === 'draft' && (
                          <ZoruButton variant="outline" size="sm" onClick={() => handleSubmit(s._id)} title="Submit for approval">
                            <Send className="h-3.5 w-3.5" />
                          </ZoruButton>
                        )}
                        {s.status === 'submitted' && (
                          <>
                            <ZoruButton variant="outline" size="sm" onClick={() => handleApprove(s._id)} title="Approve">
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            </ZoruButton>
                            <ZoruButton variant="outline" size="sm" onClick={() => handleReject(s._id)} title="Reject">
                              <X className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
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
      </ZoruCard>
    </EntityListShell>
  );
}
