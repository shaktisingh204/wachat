'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input, Button, Badge } from '@/components/zoruui';
import { Download, FileSpreadsheet, Search } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  joinedDate: string;
}

// Generate large dummy dataset for virtualization demo
const generateDummyEmployees = (count: number, shiftId: string): Employee[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `EMP-${shiftId}-${1000 + i}`,
    name: `Employee ${i + 1}`,
    department: ['Engineering', 'Sales', 'HR', 'Support'][i % 4],
    role: ['Staff', 'Manager', 'Lead', 'Associate'][i % 4],
    joinedDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1).toISOString(),
  }));
};

export function AssignedEmployeesList({ shiftId }: { shiftId: string }) {
  const [employees] = React.useState(() => generateDummyEmployees(5000, shiftId));
  const [search, setSearch] = React.useState('');
  const [deptFilter, setDeptFilter] = React.useState<string>('All');
  
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
    const rows = filteredEmployees.map(e => [e.id, e.name, e.department, e.role, e.joinedDate.split('T')[0]]);
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
          <div className="w-1/4">ID</div>
          <div className="w-1/4">Name</div>
          <div className="w-1/4">Department</div>
          <div className="w-1/4 text-right">Joined</div>
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
                  <div className="w-1/4 font-mono">{emp.id}</div>
                  <div className="w-1/4">{emp.name}</div>
                  <div className="w-1/4">{emp.department}</div>
                  {/* Hydration safe rendering using client-only formatting if needed, but here it's already a string format */}
                  <div className="w-1/4 text-right text-zoru-ink-muted">
                    {emp.joinedDate.split('T')[0]}
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
