'use client';

import { Button, Card, Input, useToast, Checkbox } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useRef,
  useCallback,
  useMemo,
  startTransition
} from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Plus, Trash, Download, FileText } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { saveWeeklyTimesheet } from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';
import { TimesheetRow, EmployeeLite } from './TimesheetRow';

export type { EmployeeLite };

type TimesheetEntry = {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  status?: 'saving' | 'saved' | 'error';
};

function addDaysToDate(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return wsToISODate(d);
  } catch {
    return '';
  }
}

function getInitialWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return wsToISODate(d);
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function NewTimesheetClient({ employees }: { employees: EmployeeLite[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, startSave] = useTransition();

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  
  // Mounted state for hydration fix
  const [isMounted, setIsMounted] = useState(false);
  
  // Init one default entry
  useEffect(() => {
    setIsMounted(true);
    setEntries([
      {
        id: generateId(),
        userId: '',
        weekStart: getInitialWeekStart(),
        weekEnd: addDaysToDate(getInitialWeekStart(), 6),
      }
    ]);
  }, []);

  // WebSockets for collaborative editing (Dummy)
  useEffect(() => {
    if (!isMounted) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket('wss://echo.websocket.org');
      ws.onopen = () => {
         console.log('WS connected for collaborative editing.');
         ws.send(JSON.stringify({ type: 'join', room: 'new_timesheets' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'update') {
             console.log('Received collaborative update', data);
          }
        } catch { }
      };
    } catch (e) {
      console.warn('WebSocket failed to connect', e);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [isMounted]);

  const filteredEntries = useMemo(() => {
    if (!filterText) return entries;
    const lower = filterText.toLowerCase();
    return entries.filter(e => {
       const emp = employees.find(x => x._id === e.userId);
       const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase() : '';
       return name.includes(lower) || e.weekStart.includes(lower) || e.weekEnd.includes(lower);
    });
  }, [entries, filterText, employees]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // row height
    overscan: 5,
  });

  const addEntry = useCallback(() => {
    setEntries(prev => [
      ...prev,
      {
        id: generateId(),
        userId: '',
        weekStart: prev.length ? prev[prev.length - 1].weekStart : getInitialWeekStart(),
        weekEnd: prev.length ? prev[prev.length - 1].weekEnd : addDaysToDate(getInitialWeekStart(), 6),
      }
    ]);
  }, []);

  const updateEntry = useCallback((id: string, field: keyof TimesheetEntry, value: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (field === 'weekStart') {
        updated.weekEnd = addDaysToDate(value, 6);
      }
      return updated;
    }));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredEntries.length && filteredEntries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  }, [filteredEntries, selectedIds.size]);

  const removeSelected = useCallback(() => {
    setEntries(prev => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      let successCount = 0;
      let firstId: string | undefined;

      // Optimistic UI updates - set status to saving
      setEntries(prev => prev.map(entry => ({ ...entry, status: 'saving' })));

      const updatedEntries = [...entries];

      for (let i = 0; i < updatedEntries.length; i++) {
        const entry = updatedEntries[i];
        if (!entry.userId) {
          toast({ title: 'Error', description: 'Employee is required for all entries.', variant: 'destructive' });
          setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
          continue;
        }

        try {
          const res = await saveWeeklyTimesheet({
            userId: entry.userId,
            weekStart: entry.weekStart,
            weekEnd: entry.weekEnd,
            status: 'draft',
          });

          if (res.error) {
            toast({ title: 'Error', description: `Failed to save for employee: ${res.error}`, variant: 'destructive' });
            setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
          } else {
            successCount++;
            if (!firstId && res.id) firstId = res.id;
            setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'saved' } : e));
          }
        } catch (error: any) {
          toast({ title: 'Error', description: `Network error for employee: ${error.message}`, variant: 'destructive' });
          setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
        }
      }

      if (successCount > 0) {
        toast({ title: 'Success', description: `Successfully created ${successCount} timesheet(s).` });
        
        // Remove successfully saved entries
        setEntries(prev => prev.filter(e => e.status !== 'saved'));
        
        // If all saved, redirect
        if (successCount === entries.length) {
          if (successCount === 1 && firstId) {
            router.push(`/dashboard/hrm/payroll/weekly-timesheets/${firstId}`);
          } else {
            router.push('/dashboard/hrm/payroll/weekly-timesheets');
          }
        }
      }
    });
  };

  const exportCSV = () => {
    const header = ['Employee', 'Week Start', 'Week End'];
    const rows = entries.map(e => {
      const emp = employees.find(em => em._id === e.userId);
      const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unknown';
      return [name, e.weekStart, e.weekEnd];
    });
    
    const csvContent = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'timesheets_draft.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Timesheet Drafts", 14, 15);
    
    const body = entries.map(e => {
      const emp = employees.find(em => em._id === e.userId);
      const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unknown';
      return [name, e.weekStart, e.weekEnd];
    });

    autoTable(doc, {
      head: [['Employee', 'Week Start', 'Week End']],
      body,
      startY: 20,
    });
    
    doc.save('timesheets_draft.pdf');
  };

  if (!isMounted) return <div className="p-4 text-center">Loading form...</div>;

  return (
    <EntityListShell
      title="New Weekly Timesheet (Bulk)"
      subtitle="Create one or more draft timesheets for employees."
      headerActions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={addEntry}>
            <Plus className="mr-2 h-4 w-4" /> Add Row
          </Button>
        </div>
      }
    >
      <Card className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
           <Input 
             placeholder="Filter entries..." 
             value={filterText}
             onChange={e => setFilterText(e.target.value)}
             className="max-w-sm h-9"
           />
           {selectedIds.size > 0 && (
             <Button variant="destructive" size="sm" onClick={removeSelected}>
               <Trash className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.size})
             </Button>
           )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 bg-[var(--st-bg-secondary)] rounded-t-lg border-b border-[var(--st-border)] text-[13px] font-medium text-[var(--st-text)]">
          <Checkbox 
            checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0} 
            onCheckedChange={toggleSelectAll} 
          />
          <div className="w-[25%]">Employee</div>
          <div className="w-[25%]">Week Start</div>
          <div className="w-[25%]">Week End</div>
          <div className="w-[15%] text-right">Actions</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div 
            ref={parentRef} 
            className="w-full overflow-y-auto max-h-[60vh]"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const entry = filteredEntries[virtualItem.index];
                return (
                  <TimesheetRow
                    key={entry.id}
                    entry={entry}
                    employees={employees}
                    isSelected={selectedIds.has(entry.id)}
                    virtualItem={virtualItem}
                    onToggleSelect={toggleSelect}
                    onUpdate={updateEntry}
                    onRemove={removeEntry}
                  />
                );
              })}
            </div>
            {filteredEntries.length === 0 && (
              <div className="p-8 text-center text-sm text-[var(--st-text-secondary)] border-t border-[var(--st-border)]/50">
                No entries found.
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[var(--st-border)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/hrm/payroll/weekly-timesheets')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || entries.length === 0}
            >
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 mr-2 animate-spin" strokeWidth={1.75} />
              ) : null}
              Create {entries.length} Timesheet{entries.length !== 1 && 's'}
            </Button>
          </div>
        </form>
      </Card>
    </EntityListShell>
  );
}
