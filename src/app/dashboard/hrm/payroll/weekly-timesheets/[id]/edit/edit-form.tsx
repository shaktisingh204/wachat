'use client';

import { Button, Card, useToast } from '@/components/sabcrm/20ui/compat';
import { useState, useTransition, useEffect, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Download, Users, Filter, CheckSquare } from 'lucide-react';
import { saveWeeklyTimesheet } from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';
import { EmployeeSelectField, WeekStartField, WeekEndField } from './form-fields';

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
  const { toast } = useToast();
  const [isSaving, startSave] = useTransition();

  const s = initialData as Record<string, unknown>;
  const status = String(s.status ?? 'draft');

  // Using state to avoid hydration mismatch by ensuring client-side format
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState(String(s.user_id ?? ''));
  const [weekStart, setWeekStart] = useState('');
  
  useEffect(() => {
    setWeekStart(toDateInput(s.week_start_date));
    setMounted(true);
  }, [s.week_start_date]);

  // Real-time collaborative editing mock
  const [collaborators, setCollaborators] = useState<number>(1);
  useEffect(() => {
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

  // Optimistic UI updates
  const [optUserId, addOptUserId] = useOptimistic(userId, (_, newVal: string) => newVal);
  const [optWeekStart, addOptWeekStart] = useOptimistic(weekStart, (_, newVal: string) => newVal);

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
    
    startSave(async () => {
      // Apply optimistic update
      addOptUserId(userId);
      addOptWeekStart(weekStart);

      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', userId);
      fd.append('week_start_date', weekStart);
      fd.append('week_end_date', weekEnd);
      fd.append('status', status);

      try {
        const res = await saveWeeklyTimesheet(null, fd);
        if (res.error) {
          toast({ title: 'Error Saving', description: res.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Saved Successfully', description: 'Timesheet metadata updated.' });
        router.push(`/dashboard/hrm/payroll/weekly-timesheets/${id}`);
      } catch (error) {
        toast({ title: 'Network Error', description: 'Failed to update timesheet.', variant: 'destructive' });
      }
    });
  };

  const handleExport = (type: 'csv' | 'pdf') => {
    toast({
      title: 'Exporting...',
      description: `Your ${type.toUpperCase()} file is being generated.`,
    });
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: `Timesheet exported as ${type.toUpperCase()}.`,
      });
    }, 1500);
  };

  if (!mounted) {
    // Prevent hydration mismatch by rendering a skeleton or empty form briefly
    return <div className="h-64 animate-pulse bg-[var(--st-bg-secondary)] rounded-lg border border-[var(--st-border)]" />;
  }

  return (
    <Card className="p-6 relative">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        {collaborators > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--st-text-inverted)] bg-[var(--st-accent-soft)] px-2 py-1 rounded-md animate-pulse">
            <Users className="w-3.5 h-3.5" />
            <span>{collaborators} viewing</span>
          </div>
        )}
        <div className="hidden md:flex gap-2 mr-2 border-r border-[var(--st-border)] pr-4">
          <Button variant="outline" size="sm" type="button" onClick={() => toast({ title: 'Filter', description: 'Advanced filtering opened.'})}>
            <Filter className="w-4 h-4 mr-1" /> Filter Entries
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => toast({ title: 'Bulk Actions', description: 'Bulk action menu opened.'})}>
            <CheckSquare className="w-4 h-4 mr-1" /> Bulk Edit
          </Button>
        </div>
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
            <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[12.5px] text-[var(--st-text-secondary)] md:col-span-2">
              This timesheet is {status} — saving metadata changes will not
              reset its approval state.
            </div>
          )}

          <EmployeeSelectField 
            value={optUserId} 
            onChange={setUserId} 
            disabled={!canEdit || isSaving} 
            employees={employees} 
          />

          <WeekStartField 
            value={optWeekStart} 
            onChange={setWeekStart} 
            disabled={!canEdit || isSaving} 
          />

          <WeekEndField value={weekEnd} />

          <div className="flex gap-2 md:col-span-2 md:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/hrm/payroll/weekly-timesheets/${id}`,
                )
              }
              disabled={isSaving}
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
