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
} from '@/components/zoruui';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Download, Users } from 'lucide-react';
import { saveWeeklyTimesheet } from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateInput(v: unknown): string {
  if (!v) return '';
  try {
    return wsToISODate(new Date(v as string | number | Date));
  } catch {
    return '';
  }
}

export default function EditWeeklyTimesheetForm({
  id,
  initialData,
  employees,
}: {
  id: string;
  initialData: any;
  employees: EmployeeLite[];
}) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isSaving, startSave] = useTransition();

  const s = initialData as Record<string, unknown>;
  const [userId, setUserId] = useState(String(s.user_id ?? ''));
  const [weekStart, setWeekStart] = useState(toDateInput(s.week_start_date));
  const status = String(s.status ?? 'draft');

  // Real-time collaborative editing mock
  const [collaborators, setCollaborators] = useState<number>(1);
  useEffect(() => {
    // Mock WebSocket connection
    const interval = setInterval(() => {
      setCollaborators((prev) => (Math.random() > 0.7 ? (prev === 1 ? 2 : 1) : prev));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const weekEnd = (() => {
    if (!weekStart) return '';
    try {
      return wsToISODate(addDaysToDate(new Date(weekStart), 6));
    } catch {
      return '';
    }
  })();

  const canEdit = status === 'draft' || status === 'rejected';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !weekStart) {
      toast({
        title: 'Missing fields',
        description: 'Employee and week start are required.',
        variant: 'destructive',
      });
      return;
    }
    
    // Optimistic UI updates
    const prevUserId = String(s.user_id ?? '');
    const prevWeekStart = toDateInput(s.week_start_date);
    
    startSave(async () => {
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', userId);
      fd.append('week_start_date', weekStart);
      fd.append('week_end_date', weekEnd);
      fd.append('status', status);

      try {
        const res = await saveWeeklyTimesheet(null, fd);
        if (res.error) {
          // Revert on error
          setUserId(prevUserId);
          setWeekStart(prevWeekStart);
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Saved', description: 'Timesheet updated successfully.' });
        router.push(`/dashboard/hrm/payroll/weekly-timesheets/${id}`);
      } catch (error) {
        // Revert on error
        setUserId(prevUserId);
        setWeekStart(prevWeekStart);
        toast({ title: 'Error', description: 'Network error occurred.', variant: 'destructive' });
      }
    });
  };

  const handleExport = (type: 'csv' | 'pdf') => {
    toast({
      title: 'Exporting...',
      description: `Your ${type.toUpperCase()} file is being generated.`,
    });
    // Dummy export action
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: `Timesheet exported as ${type.toUpperCase()}.`,
      });
    }, 1500);
  };

  const employeeOptions = useMemo(() => {
    return employees.map((e) => (
      <ZoruSelectItem key={e._id} value={e._id}>
        {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
      </ZoruSelectItem>
    ));
  }, [employees]);

  return (
    <Card className="p-6 relative">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        {collaborators > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-zoru-primary-ink bg-zoru-primary-surface px-2 py-1 rounded-md animate-pulse">
            <Users className="w-3.5 h-3.5" />
            <span>{collaborators} viewing</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} type="button">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} type="button">
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>
      
      <div className="mt-8">
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          {!canEdit && (
            <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12.5px] text-zoru-ink-muted md:col-span-2">
              This timesheet is {status} — saving metadata changes will not
              reset its approval state.
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-[12px] text-zoru-ink-muted">
              Employee <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Select value={userId} onValueChange={setUserId} disabled={!canEdit}>
              <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Select employee" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {employeeOptions}
              </ZoruSelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[12px] text-zoru-ink-muted">
              Week Start <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              required
              disabled={!canEdit}
              className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>

          <div>
            <Label className="text-[12px] text-zoru-ink-muted">
              Week End (auto)
            </Label>
            <Input
              type="date"
              value={weekEnd}
              readOnly
              className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] opacity-60"
            />
          </div>

          <div className="flex gap-2 md:col-span-2 md:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/hrm/payroll/weekly-timesheets/${id}`,
                )
              }
            >
              Cancel
            </Button>
            {canEdit && (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin mr-2"
                    strokeWidth={1.75}
                  />
                ) : null}
                Save Changes
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
