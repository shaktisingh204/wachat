'use client';

import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { ArrowDownAZ, ArrowUpAZ, Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';

type ScheduleRow = {
  no: number;
  dueDate: string;
  amount: number;
  paid?: boolean;
};

interface LoansRepaymentScheduleProps {
  schedule: ScheduleRow[];
}

function fmtMoney(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function LoansRepaymentSchedule({ schedule }: LoansRepaymentScheduleProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredAndSorted = useMemo(() => {
    let result = [...schedule];

    if (statusFilter !== 'all') {
      const isPaid = statusFilter === 'paid';
      result = result.filter((row) => Boolean(row.paid) === isPaid);
    }

    result.sort((a, b) => {
      if (sortDirection === 'asc') {
        return a.no - b.no;
      }
      return b.no - a.no;
    });

    return result;
  }, [schedule, statusFilter, sortDirection]);

  const exportCsv = () => {
    const header = ['No', 'Due Date', 'Amount', 'Status'];
    const csv = [
      header.join(','),
      ...filteredAndSorted.map((row) =>
        [
          row.no,
          `"${fmtDate(row.dueDate)}"`,
          row.amount,
          row.paid ? 'Paid' : 'Pending',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amortization-schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (schedule.length === 0) {
    return (
      <p className="text-[13px] text-[var(--st-text-secondary)]">
        No schedule generated yet. Use <strong>Generate EMI schedule</strong> in the header.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="h-8 w-[120px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="h-8 px-2"
          >
            {sortDirection === 'asc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv} className="h-8">
          <Download className="mr-2 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
        <Table>
          <THead>
            <Tr className="bg-[var(--st-bg-secondary)]/50">
              <Th className="w-16">#</Th>
              <Th>Due date</Th>
              <Th className="text-right">Amount</Th>
              <Th className="text-right">Status</Th>
            </Tr>
          </THead>
          <TBody>
            {filteredAndSorted.length === 0 ? (
              <Tr>
                <Td colSpan={4} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                  No schedule rows match the selected filter.
                </Td>
              </Tr>
            ) : (
              filteredAndSorted.map((row) => (
                <Tr key={row.no}>
                  <Td className="text-[var(--st-text-secondary)]">{row.no}</Td>
                  <Td>{fmtDate(row.dueDate)}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {fmtMoney(row.amount)}
                  </Td>
                  <Td className="text-right">
                    <Badge variant={row.paid ? 'success' : 'outline'}>
                      {row.paid ? 'Paid' : 'Pending'}
                    </Badge>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
