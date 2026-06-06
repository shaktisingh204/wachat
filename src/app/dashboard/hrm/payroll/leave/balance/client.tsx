'use client';

import { Card, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition
} from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeaveBalance,
  getLeaveTypes,
  topupLeaveBalance,
} from '@/app/actions/worksuite/leave.actions';
import type {
  WsLeaveBalanceEmployee,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';
import { useToast } from '@/components/sabcrm/20ui/compat';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function LeaveBalanceClient({
  initialBalances,
  initialTypes,
  initialYear,
}: {
  initialBalances: WsLeaveBalanceEmployee[];
  initialTypes: WsLeaveType[];
  initialYear: number;
}) {
  const [rows, setRows] = useState<WsLeaveBalanceEmployee[]>(initialBalances);
  const [types, setTypes] = useState<WsLeaveType[]>(initialTypes);
  const [isLoading, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState<string>(String(initialYear));
  const { toast } = useToast();

  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupForm, setTopupForm] = useState({
    employeeId: '',
    employeeName: '',
    leaveTypeId: '',
    leaveTypeName: '',
    amount: '',
    reason: '',
  });

  const loadData = () => {
    startTransition(async () => {
      const year = parseInt(selectedYear, 10);
      const [balances, ts] = await Promise.all([
        getLeaveBalance(undefined, year),
        getLeaveTypes(),
      ]);
      setRows(balances);
      setTypes(ts);
    });
  };

  useEffect(() => {
    if (selectedYear !== String(initialYear)) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const handleTopup = async () => {
    if (!topupForm.amount || isNaN(Number(topupForm.amount))) {
      toast({ title: 'Error', description: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setTopupLoading(true);
    const result = await topupLeaveBalance(
      topupForm.employeeId,
      topupForm.leaveTypeId,
      Number(topupForm.amount),
      parseInt(selectedYear, 10),
      topupForm.reason
    );
    setTopupLoading(false);
    if (result.success) {
      toast({ title: 'Success', description: 'Balance topped up successfully.' });
      setTopupModalOpen(false);
      loadData();
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to top up', variant: 'destructive' });
    }
  };

  const yearSelector = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--st-text-secondary)]">Year:</span>
      <Select value={selectedYear} onValueChange={setSelectedYear}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Select Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <EntityListShell
      title="Leave Balance"
      subtitle="Per-employee remaining leaves across every leave type."
      filters={yearSelector}
    >
      <div className="hidden md:block">
        <Card className="p-0 border-0 shadow-none bg-transparent">
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)] bg-white dark:bg-[var(--st-text)]">
            <table className="w-full text-left text-[13px] border-collapse relative min-w-max">
              <thead>
                <tr className="border-b border-[var(--st-border)]">
                  <th className="px-4 py-3 text-[var(--st-text-secondary)] sticky left-0 z-20 bg-[var(--st-bg-secondary)] border-r border-[var(--st-border)]">
                    Employee
                  </th>
                  {types.map((t) => (
                    <th
                      key={String(t._id)}
                      className="px-4 py-3 text-[var(--st-text-secondary)] whitespace-nowrap min-w-[150px] bg-white dark:bg-[var(--st-text)]"
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
                      className="h-24 text-center text-[var(--st-text-secondary)]"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={types.length + 1}
                      className="h-24 text-center text-[var(--st-text-secondary)]"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const byType = new Map<string, typeof r.rows[0]>(r.rows.map((x) => [x.leave_type_id, x]));
                    return (
                      <tr key={r.employee_id} className="border-b border-[var(--st-border)] last:border-0 group">
                        <td className="px-4 py-3 text-[var(--st-text)] sticky left-0 z-10 bg-[var(--st-bg-secondary)] border-r border-[var(--st-border)] shadow-[1px_0_0_0_var(--st-border)]">
                          {r.employee_name}
                        </td>
                        {types.map((t) => {
                          const row = byType.get(String(t._id));
                          if (!row) {
                            return (
                              <td
                                key={String(t._id)}
                                className="px-4 py-3 text-[var(--st-text-secondary)] text-center"
                              >
                                —
                              </td>
                            );
                          }
                          const low = row.remaining <= 1 && row.allocated > 0;
                          const percent = Math.min(100, (row.used / (row.allocated || 1)) * 100);
                          
                          return (
                            <td key={String(t._id)} className="px-4 py-3 group/cell relative hover:bg-[var(--st-bg-secondary)]">
                              <div className="flex flex-col gap-1.5 w-full min-w-[120px] max-w-[180px]">
                                <div className="flex justify-between items-center text-[12px]">
                                  <span className={low ? 'text-[var(--st-text)] font-medium' : 'text-[var(--st-text)] font-medium'}>
                                    {row.remaining} left
                                  </span>
                                  <span className="text-[var(--st-text-secondary)]">
                                    {row.used} / {row.allocated}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-[var(--st-bg-secondary)] rounded-full overflow-hidden flex relative border border-[var(--st-border)]">
                                  <div
                                    className="h-full"
                                    style={{ width: `${percent}%`, backgroundColor: t.color || '#3B82F6' }}
                                  />
                                </div>
                                {row.topup ? (
                                  <div className="text-[10px] text-[var(--st-text)] dark:text-[var(--st-text)] text-right h-4">
                                    +{row.topup} top-up
                                  </div>
                                ) : (
                                  <div className="h-4" />
                                )}
                              </div>
                              <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover/cell:opacity-100 transition-opacity flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] px-2 bg-white/95 dark:bg-[var(--st-text)]/95 backdrop-blur-sm"
                                  onClick={() => {
                                    setTopupForm({
                                      employeeId: r.employee_id,
                                      employeeName: r.employee_name,
                                      leaveTypeId: String(t._id),
                                      leaveTypeName: t.type_name,
                                      amount: '',
                                      reason: '',
                                    });
                                    setTopupModalOpen(true);
                                  }}
                                >
                                  Top Up
                                </Button>
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
      </div>

      <div className="md:hidden flex flex-col gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-[var(--st-text-secondary)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-[var(--st-text-secondary)]">No employees found.</div>
        ) : (
          rows.map((r) => {
            const byType = new Map<string, typeof r.rows[0]>(r.rows.map((x) => [x.leave_type_id, x]));
            return (
              <Card key={r.employee_id} className="p-4 space-y-4 shadow-sm border border-[var(--st-border)]">
                <div className="font-medium text-base text-[var(--st-text)] pb-2 border-b border-[var(--st-border)]">
                  {r.employee_name}
                </div>
                <div className="space-y-4">
                  {types.map((t) => {
                    const row = byType.get(String(t._id));
                    if (!row) return null;
                    const low = row.remaining <= 1 && row.allocated > 0;
                    const percent = Math.min(100, (row.used / (row.allocated || 1)) * 100);
                    
                    return (
                      <div key={String(t._id)} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="flex items-center gap-1.5 font-medium text-[var(--st-text)]">
                            <span
                              aria-hidden
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: t.color || '#94A3B8' }}
                            />
                            {t.type_name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={low ? 'text-[var(--st-text)] font-medium text-xs' : 'text-[var(--st-text)] font-medium text-xs'}>
                              {row.remaining} left
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2"
                              onClick={() => {
                                setTopupForm({
                                  employeeId: r.employee_id,
                                  employeeName: r.employee_name,
                                  leaveTypeId: String(t._id),
                                  leaveTypeName: t.type_name,
                                  amount: '',
                                  reason: '',
                                });
                                setTopupModalOpen(true);
                              }}
                            >
                              Top Up
                            </Button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-full overflow-hidden flex">
                          <div
                            className="h-full"
                            style={{ width: `${percent}%`, backgroundColor: t.color || '#3B82F6' }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-[var(--st-text-secondary)]">
                          <span>Used: {row.used} / {row.allocated}</span>
                          {row.topup ? (
                            <span className="text-[var(--st-text)] dark:text-[var(--st-text)]">
                              +{row.topup} top-up
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={topupModalOpen} onOpenChange={setTopupModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Leave Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <div className="text-sm font-medium">{topupForm.employeeName}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <div className="text-sm font-medium">{topupForm.leaveTypeName} ({selectedYear})</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount">Amount (Days)</Label>
              <Input
                id="topup-amount"
                type="number"
                step="0.5"
                placeholder="e.g. 1"
                value={topupForm.amount}
                onChange={(e) => setTopupForm({ ...topupForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-reason">Reason</Label>
              <Textarea
                id="topup-reason"
                placeholder="e.g. Comp-off for weekend work"
                value={topupForm.reason}
                onChange={(e) => setTopupForm({ ...topupForm, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTopup} disabled={topupLoading || !topupForm.amount}>
              {topupLoading ? 'Saving...' : 'Apply Top Up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
