'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams } from 'next/navigation';
import { Plus,
  RotateCw,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell
      title={rotation?.name ?? 'Rotation'}
      subtitle={rotation?.description || 'Build the repeating sequence of shifts.'}
    >

      {!rotation ? (
        <div className="text-[13px] text-zoru-ink-muted">Loading…</div>
      ) : (
        <>
          <ZoruCard className="p-6">
            <h2 className="mb-3 text-[16px] text-zoru-ink">Rotation Details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Name</ZoruLabel>
                <ZoruInput
                  defaultValue={rotation.name}
                  onBlur={(e) =>
                    e.target.value !== rotation.name &&
                    saveRotation({ name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Description</ZoruLabel>
                <ZoruInput
                  defaultValue={rotation.description}
                  onBlur={(e) =>
                    e.target.value !== rotation.description &&
                    saveRotation({ description: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink">
                <ZoruCheckbox
                  checked={rotation.is_active}
                  onCheckedChange={(v) => saveRotation({ is_active: Boolean(v) })}
                />
                <span>Active</span>
              </label>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] text-zoru-ink">Sequence</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  Cycle length: {totalCycle} day{totalCycle === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {sequences.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-4 text-center text-[13px] text-zoru-ink-muted">
                  No sequence entries yet.
                </div>
              ) : (
                sequences.map((seq, i) => {
                  const sh = shiftById(seq.shift_id);
                  return (
                    <div
                      key={String(seq._id)}
                      className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2"
                    >
                      <span className="w-6 text-[12px] font-medium text-zoru-ink-muted">
                        {i + 1}
                      </span>
                      <span
                        aria-hidden
                        className="inline-block h-4 w-4 rounded-[4px] border border-zoru-line"
                        style={{ backgroundColor: sh?.color_code || '#999' }}
                      />
                      <span className="flex-1 text-[13px] font-medium text-zoru-ink">
                        {sh?.name ?? 'Unknown shift'}
                      </span>
                      <ZoruBadge variant="info">
                        {seq.duration_days} day{seq.duration_days === 1 ? '' : 's'}
                      </ZoruBadge>
                      <ZoruButton
                        variant="outline"
                        size="icon"
                        aria-label="Remove sequence step"
                        onClick={() => removeSeq(seq._id)}
                      >
                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                      </ZoruButton>
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
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Shift</ZoruLabel>
                <ZoruSelect value={newShiftId} onValueChange={setNewShiftId}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Choose shift" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {shifts.map((s) => (
                      <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Duration (days)</ZoruLabel>
                <ZoruInput
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <ZoruButton
                  type="submit"
                  disabled={pending || !newShiftId}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Add to Sequence
                </ZoruButton>
              </div>
            </form>
          </ZoruCard>
        </>
      )}
    </EntityListShell>
  );
}
