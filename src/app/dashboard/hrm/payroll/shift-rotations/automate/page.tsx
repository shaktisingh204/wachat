'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Play,
  RotateCw } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getShiftRotations,
  runRotation,
  saveAutomateShift,
  getAutomateShifts,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsShiftRotation,
  WsAutomateShift,
} from '@/lib/worksuite/shifts-types';

export default function AutomateShiftPage() {
  const [rotations, setRotations] = useState<WsShiftRotation[]>([]);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [runs, setRuns] = useState<WsAutomateShift[]>([]);
  const [pending, startTransition] = useTransition();

  const [rotationId, setRotationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    startTransition(async () => {
      const [rots, emps, hist] = await Promise.all([
        getShiftRotations(),
        getCrmEmployees(),
        getAutomateShifts(),
      ]);
      setRotations(rots);
      setEmployees(emps);
      setRuns(hist);
    });

  useEffect(() => {
    load();
  }, []);

  const toggleEmp = (id: string, on: boolean) => {
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRun = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!rotationId || !startDate || !endDate || selectedEmps.size === 0) {
      setError('Rotation, dates and at least one employee are required.');
      return;
    }
    const ids = Array.from(selectedEmps);
    startTransition(async () => {
      const save = await saveAutomateShift({
        shift_rotation_id: rotationId,
        user_ids: ids,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        status: 'running',
      });
      if (!save.success) {
        setError(save.error ?? 'Failed to save automation');
        return;
      }
      const res = await runRotation(rotationId, startDate, endDate, ids);
      if (!res.success) {
        setError(res.error ?? 'Failed to run rotation');
        return;
      }
      setResult(
        `Inserted ${res.data?.inserted ?? 0} schedule row(s) across ${res.data?.days ?? 0} day(s).`,
      );
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Automate Shift"
        subtitle="Expand a rotation across a date range for selected employees."
        icon={Play}
      />

      <form onSubmit={handleRun} className="flex flex-col gap-4">
        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">Rotation &amp; Date Range</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Rotation</ZoruLabel>
              <ZoruSelect value={rotationId} onValueChange={setRotationId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Choose rotation" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {rotations.map((r) => (
                    <ZoruSelectItem key={String(r._id)} value={String(r._id)}>
                      {r.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Start Date</ZoruLabel>
              <ZoruInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">End Date</ZoruLabel>
              <ZoruInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">
            Employees ({selectedEmps.size} selected)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((e) => {
              const id = e._id.toString();
              const on = selectedEmps.has(id);
              return (
                <label
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink"
                >
                  <ZoruCheckbox
                    checked={on}
                    onCheckedChange={(v) => toggleEmp(id, Boolean(v))}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {e.firstName} {e.lastName}
                    </div>
                    <div className="truncate text-[11px] text-zoru-ink-muted">
                      {e.employeeId}
                    </div>
                  </div>
                </label>
              );
            })}
            {employees.length === 0 ? (
              <div className="col-span-full text-[13px] text-zoru-ink-muted">No employees found.</div>
            ) : null}
          </div>
        </ZoruCard>

        {error ? (
          <div className="rounded-lg border border-rose-50 bg-rose-50/50 px-3 py-2 text-[13px] text-zoru-danger-ink">
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="rounded-lg border border-emerald-50 bg-emerald-50/50 px-3 py-2 text-[13px] text-emerald-500">
            {result}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <ZoruButton
            type="submit"
            disabled={pending}
          >
            <Play className="h-4 w-4" strokeWidth={1.75} />
            {pending ? 'Running…' : 'Run Rotation'}
          </ZoruButton>
        </div>
      </form>

      <ZoruCard className="p-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">Recent Runs</h2>
        <div className="flex flex-col gap-2">
          {runs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-4 text-center text-[13px] text-zoru-ink-muted">
              No automation runs yet.
            </div>
          ) : (
            runs.map((r) => (
              <div
                key={String(r._id)}
                className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px]"
              >
                <RotateCw className="h-4 w-4 text-zoru-ink-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zoru-ink">
                    {new Date(r.start_date).toDateString()} → {new Date(r.end_date).toDateString()}
                  </div>
                  <div className="truncate text-[11.5px] text-zoru-ink-muted">
                    {r.user_ids.length} employee{r.user_ids.length === 1 ? '' : 's'}
                  </div>
                </div>
                <ZoruBadge
                  variant={
                    r.status === 'completed' || r.status === 'running'
                      ? 'success'
                      : r.status === 'failed'
                      ? 'danger'
                      : 'secondary'
                  }
                >
                  {r.status}
                </ZoruBadge>
              </div>
            ))
          )}
        </div>
      </ZoruCard>
    </div>
  );
}
