'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CalendarOff,
  Plus,
  Check,
  X,
  Eye,
  CalendarDays,
  Tags,
  Settings as SettingsIcon,
  Filter,
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
  getLeaves,
  getLeaveTypes,
  approveLeave,
  rejectLeave,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsLeave,
  WsLeaveStatus,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

export default function LeaveManagementPage() {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<WsLeave[]>([]);
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | WsLeaveStatus>('all');
  const [isLoading, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const [ls, ts, es] = await Promise.all([
        getLeaves(statusFilter === 'all' ? undefined : { status: statusFilter }),
        getLeaveTypes(),
        getCrmEmployees(),
      ]);
      setLeaves(ls);
      setTypes(ts);
      setEmployees((es as any[]).map((e) => ({
        _id: String(e._id),
        firstName: e.firstName,
        lastName: e.lastName,
      })));
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const typeMap = useMemo(() => {
    const m = new Map<string, WsLeaveType>();
    for (const t of types) m.set(String(t._id), t);
    return m;
  }, [types]);

  const empMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      m.set(e._id, [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || 'Unnamed');
    }
    return m;
  }, [employees]);

  const handleApprove = async (id: string) => {
    const r = await approveLeave(id);
    if (r.success) {
      toast({ title: 'Approved', description: 'Leave request approved.' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection?') || '';
    const r = await rejectLeave(id, reason);
    if (r.success) {
      toast({ title: 'Rejected', description: 'Leave request rejected.' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const statusTone = (s: WsLeaveStatus): 'green' | 'red' | 'amber' => {
    if (s === 'approved') return 'green';
    if (s === 'rejected') return 'red';
    return 'amber';
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Management"
        subtitle="Approve leave applications, track balances, and configure policies."
        icon={CalendarOff}
        actions={
          <>
            <Link href="/dashboard/hrm/payroll/leave/balance">
              <ClayButton variant="pill">Balance</ClayButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/leave/calendar">
              <ClayButton
                variant="pill"
                leading={<CalendarDays className="h-4 w-4" strokeWidth={1.75} />}
              >
                Calendar
              </ClayButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/leave/types">
              <ClayButton
                variant="pill"
                leading={<Tags className="h-4 w-4" strokeWidth={1.75} />}
              >
                Types
              </ClayButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/leave/settings">
              <ClayButton
                variant="pill"
                leading={<SettingsIcon className="h-4 w-4" strokeWidth={1.75} />}
              >
                Settings
              </ClayButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/leave/new">
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                Apply Leave
              </ClayButton>
            </Link>
          </>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">Leave Requests</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              Showing {leaves.length} {statusFilter === 'all' ? 'total' : statusFilter} request{leaves.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-clay-ink-muted" />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
            >
              <SelectTrigger className="h-9 w-[160px] rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-clay-border">
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Employee</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Type</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Duration</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Date(s)</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Days</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Applied At</th>
                <th className="px-4 py-3 font-medium text-clay-ink-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="h-24 text-center text-clay-ink-muted">
                    Loading...
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-24 text-center text-clay-ink-muted">
                    No leave requests.
                  </td>
                </tr>
              ) : (
                leaves.map((l) => {
                  const t = typeMap.get(String(l.leave_type_id));
                  const dates =
                    l.duration === 'multiple' && l.end_date
                      ? `${format(new Date(l.leave_date), 'dd MMM yy')} – ${format(new Date(l.end_date), 'dd MMM yy')}`
                      : format(new Date(l.leave_date), 'dd MMM yy');
                  return (
                    <tr key={String(l._id)} className="border-b border-clay-border last:border-0">
                      <td className="px-4 py-3 font-medium text-clay-ink">
                        {empMap.get(String(l.user_id)) || l.user_id}
                      </td>
                      <td className="px-4 py-3">
                        {t ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                            style={{
                              backgroundColor: (t.color || '#94A3B8') + '20',
                              color: t.color || '#64748B',
                              border: `1px solid ${(t.color || '#94A3B8')}40`,
                            }}
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: t.color || '#94A3B8' }}
                            />
                            {t.type_name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-clay-ink capitalize">
                        {l.duration}
                        {l.duration === 'half-day' && l.half_day_type
                          ? ` (${l.half_day_type})`
                          : ''}
                      </td>
                      <td className="px-4 py-3 text-clay-ink">{dates}</td>
                      <td className="px-4 py-3 text-clay-ink">
                        {l.days_count}
                        {l.duration === 'hours' && l.hours ? ` (${l.hours}h)` : ''}
                      </td>
                      <td className="px-4 py-3 text-clay-ink-muted">
                        {l.applied_at
                          ? format(new Date(l.applied_at), 'dd MMM yy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ClayBadge tone={statusTone(l.status)}>{l.status}</ClayBadge>
                        {l.status === 'rejected' && l.reject_reason ? (
                          <p className="mt-1 max-w-[180px] truncate text-[11px] text-clay-red">
                            {l.reject_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link href={`/dashboard/hrm/payroll/leave/${l._id}`}>
                            <ClayButton
                              variant="pill"
                              title="View"
                              leading={<Eye className="h-3.5 w-3.5" strokeWidth={1.75} />}
                            >
                              View
                            </ClayButton>
                          </Link>
                          {l.status === 'pending' && (
                            <>
                              <ClayButton
                                variant="pill"
                                onClick={() => handleApprove(String(l._id))}
                                title="Approve"
                                leading={<Check className="h-3.5 w-3.5 text-green-600" strokeWidth={1.75} />}
                              >
                                Approve
                              </ClayButton>
                              <ClayButton
                                variant="pill"
                                onClick={() => handleReject(String(l._id))}
                                title="Reject"
                                leading={<X className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />}
                              >
                                Reject
                              </ClayButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
