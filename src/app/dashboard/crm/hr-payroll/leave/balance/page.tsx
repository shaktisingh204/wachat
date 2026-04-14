'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarCheck, ArrowLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getLeaveBalance,
  getLeaveTypes,
} from '@/app/actions/worksuite/leave.actions';
import type {
  WsLeaveBalanceEmployee,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';

export default function LeaveBalancePage() {
  const [rows, setRows] = useState<WsLeaveBalanceEmployee[]>([]);
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [balances, ts] = await Promise.all([
        getLeaveBalance(),
        getLeaveTypes(),
      ]);
      setRows(balances);
      setTypes(ts);
    });
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Balance"
        subtitle="Per-employee remaining leaves across every leave type."
        icon={CalendarCheck}
        actions={
          <Link href="/dashboard/crm/hr-payroll/leave">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                {types.map((t) => (
                  <TableHead
                    key={String(t._id)}
                    className="text-clay-ink-muted"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.color || '#94A3B8' }}
                      />
                      {t.type_name}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={types.length + 1} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={types.length + 1} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const byType = new Map(r.rows.map((x) => [x.leave_type_id, x]));
                  return (
                    <TableRow key={r.employee_id} className="border-clay-border">
                      <TableCell className="text-[13px] font-medium text-clay-ink">
                        {r.employee_name}
                      </TableCell>
                      {types.map((t) => {
                        const row = byType.get(String(t._id));
                        if (!row) {
                          return (
                            <TableCell
                              key={String(t._id)}
                              className="text-[13px] text-clay-ink-muted"
                            >
                              —
                            </TableCell>
                          );
                        }
                        const low = row.remaining <= 1 && row.allocated > 0;
                        return (
                          <TableCell
                            key={String(t._id)}
                            className="text-[13px] text-clay-ink"
                          >
                            <div className="flex flex-col">
                              <span
                                className={
                                  low
                                    ? 'font-semibold text-clay-red'
                                    : 'font-semibold text-clay-ink'
                                }
                              >
                                {row.remaining} / {row.allocated}
                              </span>
                              <span className="text-[11px] text-clay-ink-muted">
                                used: {row.used}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
