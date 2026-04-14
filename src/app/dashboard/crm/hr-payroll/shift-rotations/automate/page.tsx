'use client';

import { useEffect, useState, useTransition } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
        <ClayCard>
          <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">Rotation &amp; Date Range</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-clay-ink-muted">Rotation</Label>
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
              <Label className="text-[12px] text-clay-ink-muted">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-clay-ink-muted">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </ClayCard>

        <ClayCard>
          <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">
            Employees ({selectedEmps.size} selected)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((e) => {
              const id = e._id.toString();
              const on = selectedEmps.has(id);
              return (
                <label
                  key={id}
                  className="flex items-center gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2 text-[13px] text-clay-ink"
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => toggleEmp(id, Boolean(v))}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {e.firstName} {e.lastName}
                    </div>
                    <div className="truncate text-[11px] text-clay-ink-muted">
                      {e.employeeId}
                    </div>
                  </div>
                </label>
              );
            })}
            {employees.length === 0 ? (
              <div className="col-span-full text-[13px] text-clay-ink-muted">No employees found.</div>
            ) : null}
          </div>
        </ClayCard>

        {error ? (
          <div className="rounded-clay-md border border-clay-red-soft bg-clay-red-soft/50 px-3 py-2 text-[13px] text-clay-red">
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="rounded-clay-md border border-clay-green-soft bg-clay-green-soft/50 px-3 py-2 text-[13px] text-clay-green">
            {result}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <ClayButton
            variant="obsidian"
            type="submit"
            disabled={pending}
            leading={<Play className="h-4 w-4" strokeWidth={1.75} />}
          >
            {pending ? 'Running…' : 'Run Rotation'}
          </ClayButton>
        </div>
      </form>

      <ClayCard>
        <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">Recent Runs</h2>
        <div className="flex flex-col gap-2">
          {runs.length === 0 ? (
            <div className="rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 p-4 text-center text-[13px] text-clay-ink-muted">
              No automation runs yet.
            </div>
          ) : (
            runs.map((r) => (
              <div
                key={String(r._id)}
                className="flex items-center gap-3 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2 text-[13px]"
              >
                <RotateCw className="h-4 w-4 text-clay-ink-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-clay-ink">
                    {new Date(r.start_date).toDateString()} → {new Date(r.end_date).toDateString()}
                  </div>
                  <div className="truncate text-[11.5px] text-clay-ink-muted">
                    {r.user_ids.length} employee{r.user_ids.length === 1 ? '' : 's'}
                  </div>
                </div>
                <ClayBadge
                  tone={
                    r.status === 'completed' || r.status === 'running'
                      ? 'green'
                      : r.status === 'failed'
                      ? 'red'
                      : 'neutral'
                  }
                >
                  {r.status}
                </ClayBadge>
              </div>
            ))
          )}
        </div>
      </ClayCard>
    </div>
  );
}
