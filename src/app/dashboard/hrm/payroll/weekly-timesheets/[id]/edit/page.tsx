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
import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getWeeklyTimesheetById,
  saveWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Coerce a stored Date / ISO string into a `YYYY-MM-DD` input value. */
function toDateInput(v: unknown): string {
  if (!v) return '';
  try {
    return wsToISODate(new Date(v as string | number | Date));
  } catch {
    return '';
  }
}

export default function EditWeeklyTimesheetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState('draft');
  const [userId, setUserId] = useState('');
  const [weekStart, setWeekStart] = useState('');

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
      const [sheet, rows] = await Promise.all([
        getWeeklyTimesheetById(id),
        getCrmEmployees(),
      ]);
      setEmployees(
        (rows as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
      if (!sheet) {
        setLoadFailed(true);
        return;
      }
      const s = sheet as Record<string, unknown>;
      setUserId(String(s.user_id ?? ''));
      setWeekStart(toDateInput(s.week_start_date));
      setStatus(String(s.status ?? 'draft'));
      setLoaded(true);
    });
  }, [id]);

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
    startSave(async () => {
      const fd = new FormData();
      // Sending `_id` makes `hrSave` update the existing document.
      fd.append('_id', id);
      fd.append('user_id', userId);
      fd.append('week_start_date', weekStart);
      fd.append('week_end_date', weekEnd);
      fd.append('status', status);
      // Hours totals are recomputed from entries — leave them untouched.

      const res = await saveWeeklyTimesheet(null, fd);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved', description: 'Timesheet updated.' });
      router.push(`/dashboard/hrm/payroll/weekly-timesheets/${id}`);
    });
  };

  return (
    <EntityListShell
      title="Edit Weekly Timesheet"
      subtitle="Update the employee or week for this timesheet."
    >
      <Card className="p-6">
        {isLoading && !loaded && !loadFailed ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Loading…
          </div>
        ) : loadFailed ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Timesheet not found.
          </div>
        ) : (
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
              <Select value={userId} onValueChange={setUserId}>
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id} value={e._id}>
                      {[e.firstName, e.lastName].filter(Boolean).join(' ') ||
                        'Unnamed'}
                    </ZoruSelectItem>
                  ))}
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

            <div className="flex gap-2 md:col-span-2 md:justify-end">
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null}
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Card>
    </EntityListShell>
  );
}
