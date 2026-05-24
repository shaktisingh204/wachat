'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
  ZoruCheckbox,
} from '@/components/zoruui';
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

export type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

type TimesheetEntry = {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
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
  const { toast } = useZoruToast();
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
    try {
      const ws = new WebSocket('wss://echo.websocket.org');
      ws.onopen = () => {
         console.log('WS connected for collaborative editing.');
         ws.send(JSON.stringify({ type: 'join', room: 'new_timesheets' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'remote_update') {
             toast({ title: 'Collaborative Update', description: 'Another user modified the form.' });
          }
        } catch(e) {}
      };
      return () => ws.close();
    } catch(e) {
      console.warn('WebSocket failed to connect', e);
    }
  }, [isMounted, toast]);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: generateId(),
        userId: '',
        weekStart: getInitialWeekStart(),
        weekEnd: addDaysToDate(getInitialWeekStart(), 6),
      }
    ]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter(e => e.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeSelected = () => {
    setEntries((prev) => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
  };

  const updateEntry = useCallback((id: string, field: keyof TimesheetEntry, value: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        const next = { ...e, [field]: value };
        if (field === 'weekStart') {
          next.weekEnd = addDaysToDate(value, 6);
        }
        return next;
      }
      return e;
    }));
  }, []);

  const filteredEntries = useMemo(() => {
    if (!filterText) return entries;
    const lower = filterText.toLowerCase();
    return entries.filter(e => {
      const emp = employees.find(em => em._id === e.userId);
      const name = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
      return name.includes(lower) || e.weekStart.includes(lower);
    });
  }, [entries, filterText, employees]);

  // Virtualization for large lists
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // height of one row
    overscan: 5,
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length && filteredEntries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = entries.filter(e => e.userId && e.weekStart);
    if (toSave.length === 0) {
      toast({
        title: 'Missing fields',
        description: 'Please ensure at least one entry has an employee and week start selected.',
        variant: 'destructive',
      });
      return;
    }
    
    // Optimistic mutation / save
    startSave(async () => {
      let successCount = 0;
      let firstId = null;
      for (const entry of toSave) {
        const fd = new FormData();
        fd.append('user_id', entry.userId);
        fd.append('week_start_date', entry.weekStart);
        fd.append('week_end_date', entry.weekEnd);
        fd.append('total_hours', '0');
        fd.append('total_minutes', '0');
        fd.append('status', 'draft');

        const res = await saveWeeklyTimesheet(null, fd);
        if (res.error) {
          toast({ title: 'Error', description: `Failed to save for ${entry.userId}: ${res.error}`, variant: 'destructive' });
        } else {
          successCount++;
          if (!firstId && res.id) firstId = res.id;
        }
      }

      if (successCount > 0) {
        toast({ title: 'Success', description: `Created ${successCount} timesheet(s) as draft.` });
        if (successCount === 1 && firstId) {
          router.push(`/dashboard/hrm/payroll/weekly-timesheets/${firstId}`);
        } else {
          router.push('/dashboard/hrm/payroll/weekly-timesheets');
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

        <div className="flex items-center gap-4 px-4 py-2 bg-zoru-surface rounded-t-lg border-b border-zoru-line text-[13px] font-medium text-zoru-ink">
          <ZoruCheckbox 
            checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0} 
            onCheckedChange={toggleSelectAll} 
          />
          <div className="w-[30%]">Employee</div>
          <div className="w-[30%]">Week Start</div>
          <div className="w-[30%]">Week End</div>
          <div className="w-[10%] text-right">Actions</div>
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
                  <div
                    key={entry.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="flex items-center gap-4 px-4 border-b border-zoru-line/50 hover:bg-zoru-bg/50 transition-colors"
                  >
                    <ZoruCheckbox 
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => toggleSelect(entry.id)}
                    />
                    
                    <div className="w-[30%]">
                      <Select 
                        value={entry.userId} 
                        onValueChange={(val) => updateEntry(entry.id, 'userId', val)}
                      >
                        <ZoruSelectTrigger className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                          <ZoruSelectValue placeholder="Select employee" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          {employees.map((e) => (
                            <ZoruSelectItem key={e._id} value={e._id}>
                              {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                            </ZoruSelectItem>
                          ))}
                        </ZoruSelectContent>
                      </Select>
                    </div>

                    <div className="w-[30%]">
                      <Input
                        type="date"
                        value={entry.weekStart}
                        onChange={(e) => updateEntry(entry.id, 'weekStart', e.target.value)}
                        required
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                    </div>

                    <div className="w-[30%]">
                      <Input
                        type="date"
                        value={entry.weekEnd}
                        readOnly
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px] opacity-60"
                      />
                    </div>

                    <div className="w-[10%] flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-zoru-danger-ink hover:bg-zoru-danger-bg hover:text-zoru-danger-ink"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-zoru-line">
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
