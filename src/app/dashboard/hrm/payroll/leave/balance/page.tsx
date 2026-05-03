'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarCheck, ArrowLeft } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
          <Link href="/dashboard/hrm/payroll/leave">
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                {types.map((t) => (
                  <th
                    key={String(t._id)}
                    className="px-4 py-3 font-medium text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.color || '#94A3B8' }}
                      />
                      {t.type_name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={types.length + 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={types.length + 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const byType = new Map(r.rows.map((x) => [x.leave_type_id, x]));
                  return (
                    <tr key={r.employee_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.employee_name}
                      </td>
                      {types.map((t) => {
                        const row = byType.get(String(t._id));
                        if (!row) {
                          return (
                            <td
                              key={String(t._id)}
                              className="px-4 py-3 text-muted-foreground"
                            >
                              —
                            </td>
                          );
                        }
                        const low = row.remaining <= 1 && row.allocated > 0;
                        return (
                          <td key={String(t._id)} className="px-4 py-3">
                            <div className="flex flex-col">
                              <span
                                className={
                                  low
                                    ? 'font-semibold text-red-500'
                                    : 'font-semibold text-foreground'
                                }
                              >
                                {row.remaining} / {row.allocated}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                used: {row.used}
                              </span>
                            </div>
                          </td>
                        );
                      })}
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
