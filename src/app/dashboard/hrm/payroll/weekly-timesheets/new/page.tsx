'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { saveWeeklyTimesheet } from '@/app/actions/worksuite/time.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function NewWeeklyTimesheetPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoadingEmps, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  const [userId, setUserId] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    // default to this Monday
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return wsToISODate(d);
  });

  const weekEnd = (() => {
    if (!weekStart) return '';
    try {
      return wsToISODate(addDaysToDate(new Date(weekStart), 6));
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    startLoad(async () => {
      const rows = await getCrmEmployees();
      setEmployees(
        (rows as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
    });
  }, []);

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
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('week_start_date', weekStart);
      fd.append('week_end_date', weekEnd);
      fd.append('total_hours', '0');
      fd.append('total_minutes', '0');
      fd.append('status', 'draft');

      const res = await saveWeeklyTimesheet(null, fd);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Created', description: 'Timesheet created as draft.' });
      router.push(
        res.id
          ? `/dashboard/hrm/payroll/weekly-timesheets/${res.id}`
          : '/dashboard/hrm/payroll/weekly-timesheets',
      );
    });
  };

  return (
    <EntityListShell
      title="New Weekly Timesheet"
      subtitle="Create a draft timesheet for an employee for a given week."
    >

      <ZoruCard className="p-6">
        {isLoadingEmps ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Loading employees…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Employee <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruSelect value={userId} onValueChange={setUserId}>
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id} value={e._id}>
                      {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Week Start <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                required
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Week End (auto)</ZoruLabel>
              <ZoruInput
                type="date"
                value={weekEnd}
                readOnly
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] opacity-60"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 md:justify-end">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/hrm/payroll/weekly-timesheets')}
              >
                Cancel
              </ZoruButton>
              <ZoruButton
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null}
                Create Timesheet
              </ZoruButton>
            </div>
          </form>
        )}
      </ZoruCard>
    </EntityListShell>
  );
}
