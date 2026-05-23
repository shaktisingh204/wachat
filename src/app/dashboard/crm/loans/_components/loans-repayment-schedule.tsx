'use client';

import {
  Badge,
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
      <p className="text-[13px] text-zoru-ink-muted">
        No schedule generated yet. Use <strong>Generate EMI schedule</strong> in the header.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <ZoruSelectTrigger className="h-8 w-[120px] text-[13px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="paid">Paid</ZoruSelectItem>
              <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
            </ZoruSelectContent>
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

      <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow className="bg-zoru-surface/50">
              <ZoruTableHead className="w-16">#</ZoruTableHead>
              <ZoruTableHead>Due date</ZoruTableHead>
              <ZoruTableHead className="text-right">Amount</ZoruTableHead>
              <ZoruTableHead className="text-right">Status</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredAndSorted.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={4} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                  No schedule rows match the selected filter.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filteredAndSorted.map((row) => (
                <ZoruTableRow key={row.no}>
                  <ZoruTableCell className="text-zoru-ink-muted">{row.no}</ZoruTableCell>
                  <ZoruTableCell>{fmtDate(row.dueDate)}</ZoruTableCell>
                  <ZoruTableCell className="text-right font-mono tabular-nums">
                    {fmtMoney(row.amount)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant={row.paid ? 'success' : 'outline'}>
                      {row.paid ? 'Paid' : 'Pending'}
                    </Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </Table>
      </div>
    </div>
  );
}
