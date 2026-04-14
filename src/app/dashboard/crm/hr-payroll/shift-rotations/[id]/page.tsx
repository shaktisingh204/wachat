'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { Plus, RotateCw, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getShiftRotation,
  saveShiftRotation,
  getRotationSequences,
  saveRotationSequence,
  deleteRotationSequence,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsShiftRotation,
  WsShiftRotationSequence,
  WsEmployeeShift,
} from '@/lib/worksuite/shifts-types';

export default function ShiftRotationDetailPage() {
  const params = useParams<{ id: string }>();
  const rotationId = params?.id ?? '';

  const [rotation, setRotation] = useState<WsShiftRotation | null>(null);
  const [sequences, setSequences] = useState<WsShiftRotationSequence[]>([]);
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [pending, startTransition] = useTransition();
  const [newShiftId, setNewShiftId] = useState('');
  const [newDuration, setNewDuration] = useState<number>(1);

  const load = useCallback(() => {
    if (!rotationId) return;
    startTransition(async () => {
      const [r, seqs, shiftsRes] = await Promise.all([
        getShiftRotation(rotationId),
        getRotationSequences(rotationId),
        getEmployeeShifts(),
      ]);
      setRotation(r);
      setSequences(seqs);
      setShifts(shiftsRes);
    });
  }, [rotationId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRotation = (partial: Partial<WsShiftRotation>) => {
    if (!rotation?._id) return;
    startTransition(async () => {
      await saveShiftRotation({ ...rotation, ...partial });
      load();
    });
  };

  const addSequence = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newShiftId || !newDuration) return;
    startTransition(async () => {
      await saveRotationSequence({
        shift_rotation_id: rotationId,
        shift_id: newShiftId,
        duration_days: newDuration,
        sequence_order: (sequences.at(-1)?.sequence_order ?? 0) + 1,
      });
      setNewShiftId('');
      setNewDuration(1);
      load();
    });
  };

  const removeSeq = (id?: string) => {
    if (!id) return;
    startTransition(async () => {
      await deleteRotationSequence(id);
      load();
    });
  };

  const shiftById = (id: string) => shifts.find((s) => String(s._id) === id);
  const totalCycle = sequences.reduce((acc, s) => acc + Number(s.duration_days ?? 0), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={rotation?.name ?? 'Rotation'}
        subtitle={rotation?.description || 'Build the repeating sequence of shifts.'}
        icon={RotateCw}
        actions={
          rotation ? (
            <ClayBadge tone={rotation.is_active ? 'green' : 'neutral'}>
              {rotation.is_active ? 'active' : 'inactive'}
            </ClayBadge>
          ) : null
        }
      />

      {!rotation ? (
        <div className="text-[13px] text-clay-ink-muted">Loading…</div>
      ) : (
        <>
          <ClayCard>
            <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">Rotation Details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">Name</Label>
                <Input
                  defaultValue={rotation.name}
                  onBlur={(e) =>
                    e.target.value !== rotation.name &&
                    saveRotation({ name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">Description</Label>
                <Input
                  defaultValue={rotation.description}
                  onBlur={(e) =>
                    e.target.value !== rotation.description &&
                    saveRotation({ description: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2 text-[13px] text-clay-ink">
                <Checkbox
                  checked={rotation.is_active}
                  onCheckedChange={(v) => saveRotation({ is_active: Boolean(v) })}
                />
                <span>Active</span>
              </label>
            </div>
          </ClayCard>

          <ClayCard>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-clay-ink">Sequence</h2>
                <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
                  Cycle length: {totalCycle} day{totalCycle === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {sequences.length === 0 ? (
                <div className="rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 p-4 text-center text-[13px] text-clay-ink-muted">
                  No sequence entries yet.
                </div>
              ) : (
                sequences.map((seq, i) => {
                  const sh = shiftById(seq.shift_id);
                  return (
                    <div
                      key={String(seq._id)}
                      className="flex items-center gap-3 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2"
                    >
                      <span className="w-6 text-[12px] font-medium text-clay-ink-muted">
                        {i + 1}
                      </span>
                      <span
                        aria-hidden
                        className="inline-block h-4 w-4 rounded-[4px] border border-clay-border"
                        style={{ backgroundColor: sh?.color_code || '#999' }}
                      />
                      <span className="flex-1 text-[13px] font-medium text-clay-ink">
                        {sh?.name ?? 'Unknown shift'}
                      </span>
                      <ClayBadge tone="blue">
                        {seq.duration_days} day{seq.duration_days === 1 ? '' : 's'}
                      </ClayBadge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSeq(seq._id)}
                      >
                        <Trash2 className="h-4 w-4 text-clay-red" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={addSequence}
              className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]"
            >
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">Shift</Label>
                <Select value={newShiftId} onValueChange={setNewShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] text-clay-ink-muted">Duration (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <ClayButton
                  variant="obsidian"
                  type="submit"
                  disabled={pending || !newShiftId}
                  leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Add to Sequence
                </ClayButton>
              </div>
            </form>
          </ClayCard>
        </>
      )}
    </div>
  );
}
