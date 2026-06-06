'use client';

import * as React from 'react';
import { UserMinus, Download, Printer, Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fmtDate } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  Input,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Checkbox,
} from '@/components/sabcrm/20ui/compat';

interface AssignedEmployee {
  employeeId: string;
  name: string;
  email?: string;
  assignedAt: string;
}

interface AssignedEmployeesTableProps {
  employees: AssignedEmployee[];
  removingId: string | null;
  onRemove: (employeeId: string) => Promise<void>;
  onBulkRemove: (employeeIds: string[]) => Promise<void>;
}

export function AssignedEmployeesTable({
  employees,
  removingId,
  onRemove,
  onBulkRemove,
}: AssignedEmployeesTableProps) {
  const [filter, setFilter] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkRemoving, setIsBulkRemoving] = React.useState(false);

  const filteredEmployees = React.useMemo(() => {
    if (!filter) return employees;
    const lowerFilter = filter.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(lowerFilter) ||
        (e.email && e.email.toLowerCase().includes(lowerFilter))
    );
  }, [employees, filter]);

  // Virtualizer for performance
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approx height of a table row
    overscan: 5,
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredEmployees.map((e) => e.employeeId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkRemoving(true);
    await onBulkRemove(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsBulkRemoving(false);
  };

  const exportCSV = () => {
    const headers = ['Employee Name', 'Email', 'Assigned Date'];
    const rows = filteredEmployees.map((e) => [
      e.name,
      e.email || '',
      fmtDate(e.assignedAt),
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assigned_employees.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Card className="flex flex-col gap-4 p-5 print:shadow-none print:border-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--st-text)]">Assigned Employees</h2>
          <Badge variant="secondary">{employees.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} title="Export to CSV">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} title="Export to PDF (Print)">
            <Printer className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 justify-between print:hidden">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
          <Input
            placeholder="Filter by name or email..."
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--st-text-secondary)]">{selectedIds.size} selected</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkRemove}
              disabled={isBulkRemoving}
            >
              {isBulkRemoving ? 'Removing...' : 'Remove Selected'}
            </Button>
          </div>
        )}
      </div>

      {filteredEmployees.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
          {employees.length === 0
            ? 'No employees are assigned to this group yet.'
            : 'No employees match your filter.'}
        </p>
      ) : (
        <div
          ref={parentRef}
          className="overflow-x-auto rounded-md border border-[var(--st-border)] max-h-[500px] overflow-y-auto print:overflow-visible print:max-h-none print:border-none"
        >
          <table className="w-full text-sm caption-bottom">
            <ZoruTableHeader className="sticky top-0 bg-[var(--st-bg-secondary)] z-10 print:static">
              <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                <ZoruTableHead className="w-12 print:hidden">
                  <Checkbox
                    checked={
                      selectedIds.size === filteredEmployees.length &&
                      filteredEmployees.length > 0
                    }
                    onCheckedChange={(c) => handleSelectAll(!!c)}
                  />
                </ZoruTableHead>
                <ZoruTableHead>Employee</ZoruTableHead>
                <ZoruTableHead>Email</ZoruTableHead>
                <ZoruTableHead>Assigned</ZoruTableHead>
                <ZoruTableHead className="text-right print:hidden">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
              className="print:h-auto"
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const e = filteredEmployees[virtualRow.index];
                return (
                  <ZoruTableRow
                    key={e.employeeId}
                    className="border-[var(--st-border)] absolute w-full print:static print:transform-none"
                    style={{
                      top: 0,
                      left: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ZoruTableCell className="w-12 print:hidden">
                      <Checkbox
                        checked={selectedIds.has(e.employeeId)}
                        onCheckedChange={(c) => handleSelectOne(e.employeeId, !!c)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="font-medium text-[var(--st-text)]">
                      {e.name}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                      {e.email ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                      {mounted ? fmtDate(e.assignedAt) : ''}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right print:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${e.name}`}
                        disabled={removingId === e.employeeId || isBulkRemoving}
                        onClick={() => void onRemove(e.employeeId)}
                      >
                        {removingId === e.employeeId ? (
                          <span className="h-3.5 w-3.5 border-2 border-[var(--st-danger)] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                        )}
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </table>
        </div>
      )}
    </Card>
  );
}
