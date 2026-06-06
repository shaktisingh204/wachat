'use client';

import { useState, useMemo } from 'react';
import { Play, Search } from 'lucide-react';
import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import type { WsShiftRotation } from '@/lib/worksuite/shifts-types';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface AutomateFormProps {
  rotations: WsShiftRotation[];
  employees: WithId<CrmEmployee>[];
  onRun: (rotationId: string, startDate: string, endDate: string, selectedEmps: Set<string>) => void;
  pending: boolean;
}

export default function AutomateForm({ rotations, employees, onRun, pending }: AutomateFormProps) {
  const [rotationId, setRotationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(searchQuery.toLowerCase()) || e.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [employees, searchQuery]);

  const toggleEmp = (id: string, on: boolean) => {
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (on: boolean) => {
    if (on) {
      setSelectedEmps(new Set(filteredEmployees.map(e => String(e._id))));
    } else {
      setSelectedEmps(new Set());
    }
  };

  const isAllSelected = filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmps.has(String(e._id)));

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onRun(rotationId, startDate, endDate, selectedEmps);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card className="p-6">
        <h2 className="mb-3 text-[16px] text-[var(--st-text)]">Rotation &amp; Date Range</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-[var(--st-text-secondary)]">Rotation</Label>
            <Select value={rotationId} onValueChange={setRotationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose rotation" />
              </SelectTrigger>
              <SelectContent>
                {rotations.map((r) => (
                  <SelectItem key={String(r._id)} value={String(r._id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-[var(--st-text-secondary)]">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-[var(--st-text-secondary)]">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <h2 className="text-[16px] text-[var(--st-text)]">
            Employees ({selectedEmps.size} selected)
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-[var(--st-text-secondary)]" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-[200px]"
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)] cursor-pointer">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(v) => handleSelectAll(Boolean(v))}
              />
              Select All
            </label>
          </div>
        </div>
        
        <div 
          ref={parentRef}
          className="h-[250px] overflow-auto rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)]"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const e = filteredEmployees[virtualRow.index];
              const id = String(e._id);
              const on = selectedEmps.has(id);
              
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center px-4 py-2 border-b border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] transition-colors"
                >
                  <label className="flex items-center gap-3 w-full cursor-pointer">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => toggleEmp(id, Boolean(v))}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[13px]">
                        {e.firstName} {e.lastName}
                      </div>
                      <div className="truncate text-[11px] text-[var(--st-text-secondary)]">
                        {e.employeeId}
                      </div>
                    </div>
                  </label>
                </div>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="p-4 text-center text-[13px] text-[var(--st-text-secondary)]">
                No employees found.
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={pending}
        >
          <Play className="h-4 w-4" strokeWidth={1.75} />
          {pending ? 'Running…' : 'Run Rotation'}
        </Button>
      </div>
    </form>
  );
}
