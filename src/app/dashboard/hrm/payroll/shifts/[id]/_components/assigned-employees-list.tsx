'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input, Button, Badge, Checkbox, useZoruToast } from '@/components/zoruui';
import { Download, FileSpreadsheet, Search, Trash } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  joinedDate: string;
}

// Generate large dummy dataset for virtualization demo
const generateDummyEmployees = (count: number, shiftId: string): Employee[] => {
  return Array.from({ length: count }).map((_, i) => {
    const year = 2020 + (i % 4);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    return {
      id: `EMP-${shiftId}-${1000 + i}`,
      name: `Employee ${i + 1}`,
      department: ['Engineering', 'Sales', 'HR', 'Support'][i % 4],
      role: ['Staff', 'Manager', 'Lead', 'Associate'][i % 4],
      joinedDate: `${year}-${month}-${day}`, // Deterministic format to avoid hydration mismatch
    };
  });
};

export function AssignedEmployeesList({ shiftId }: { shiftId: string }) {
  const [employees] = React.useState(() => generateDummyEmployees(5000, shiftId));
  const [search, setSearch] = React.useState('');
  const [deptFilter, setDeptFilter] = React.useState<string>('All');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const { toast } = useZoruToast();
  
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Memoize filtering (Performance: Memoize expensive calculations)
  const filteredEmployees = React.useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                            emp.id.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, search, deptFilter]);

  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  const exportToCsv = () => {
    const headers = ['ID', 'Name', 'Department', 'Role', 'Joined Date'];
    const rows = filteredEmployees.map(e => [e.id, e.name, e.department, e.role, e.joinedDate]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shift-${shiftId}-employees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    // In a real app we'd use jspdf or a server route. For now, trigger print dialog
    window.print();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleRemoveSelected = () => {
    // In a real app, this would call an API
    toast({
      title: 'Success',
      description: `Removed ${selectedIds.size} employees from shift`,
    });
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zoru-line bg-zoru-bg p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-zoru-ink">Assigned Employees</h3>
          <p className="text-sm text-zoru-ink-muted">
            {filteredEmployees.length} employees currently assigned to this shift.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleRemoveSelected}>
              <Trash className="mr-2 h-4 w-4" /> Remove ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={exportToCsv}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportToPdf}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <Input 
            placeholder="Search employees..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Engineering', 'Sales', 'HR', 'Support'].map(dept => (
            <Badge 
              key={dept} 
              variant={deptFilter === dept ? 'info' : 'outline'}
              className="cursor-pointer"
              onClick={() => setDeptFilter(dept)}
            >
              {dept}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-zoru-line">
        <div className="flex bg-zoru-subtle px-4 py-3 text-sm font-medium text-zoru-ink-muted">
          <div className="w-[40px]">
            <Checkbox 
              checked={filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length}
              onCheckedChange={(c) => handleSelectAll(Boolean(c))}
            />
          </div>
          <div className="flex-1">ID</div>
          <div className="flex-1">Name</div>
          <div className="flex-1">Department</div>
          <div className="flex-1 text-right">Joined</div>
        </div>
        
        <div 
          ref={parentRef} 
          className="h-[400px] overflow-auto"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const emp = filteredEmployees[virtualRow.index];
              return (
                <div
                  key={emp.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center border-b border-zoru-line px-4 text-sm hover:bg-zoru-subtle"
                >
                  <div className="w-[40px]">
                    <Checkbox 
                      checked={selectedIds.has(emp.id)}
                      onCheckedChange={(c) => handleSelectOne(emp.id, Boolean(c))}
                    />
                  </div>
                  <div className="flex-1 font-mono">{emp.id}</div>
                  <div className="flex-1">{emp.name}</div>
                  <div className="flex-1">{emp.department}</div>
                  {/* Hydration safe rendering with deterministic string */}
                  <div className="flex-1 text-right text-zoru-ink-muted">
                    {emp.joinedDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
