'use client';

import { Card, Button } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell
      title="Leave Balance"
      subtitle="Per-employee remaining leaves across every leave type."
    >

      <Card className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line">
                <th className="px-4 py-3 text-zoru-ink-muted">Employee</th>
                {types.map((t) => (
                  <th
                    key={String(t._id)}
                    className="px-4 py-3 text-zoru-ink-muted"
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
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={types.length + 1}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const byType = new Map(r.rows.map((x) => [x.leave_type_id, x]));
                  return (
                    <tr key={r.employee_id} className="border-b border-zoru-line last:border-0">
                      <td className="px-4 py-3 text-zoru-ink">
                        {r.employee_name}
                      </td>
                      {types.map((t) => {
                        const row = byType.get(String(t._id));
                        if (!row) {
                          return (
                            <td
                              key={String(t._id)}
                              className="px-4 py-3 text-zoru-ink-muted"
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
                                    ? 'text-red-500'
                                    : 'text-zoru-ink'
                                }
                              >
                                {row.remaining} / {row.allocated}
                              </span>
                              <span className="text-[11px] text-zoru-ink-muted">
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
      </Card>
    </EntityListShell>
  );
}
