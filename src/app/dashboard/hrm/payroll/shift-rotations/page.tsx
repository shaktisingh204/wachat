'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Edit, Play, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  getShiftRotations,
  saveShiftRotation,
  deleteShiftRotation,
} from '@/app/actions/worksuite/shifts.actions';
import type { WsShiftRotation } from '@/lib/worksuite/shifts-types';

export default function ShiftRotationsPage() {
  const [rotations, setRotations] = useState<WsShiftRotation[]>([]);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = () =>
    startTransition(async () => {
      setRotations(await getShiftRotations());
    });

  useEffect(() => {
    load();
  }, []);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await saveShiftRotation({ name, description, is_active: true });
      setName('');
      setDescription('');
      load();
    });
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    if (!confirm('Delete this rotation and its sequence?')) return;
    startTransition(async () => {
      await deleteShiftRotation(id);
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Shift Rotations"
        subtitle="Define cyclical shift sequences to automate assignment."
        icon={RotateCw}
        actions={
          <Link href="/dashboard/hrm/payroll/shift-rotations/automate">
            <ClayButton
              variant="obsidian"
              leading={<Play className="h-4 w-4" strokeWidth={1.75} />}
            >
              Automate Shift
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">Create Rotation</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-clay-ink-muted">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="2-2-3 rotation"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-clay-ink-muted">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-end">
            <ClayButton
              variant="obsidian"
              type="submit"
              disabled={pending}
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Add
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">All Rotations</h2>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-clay-border bg-clay-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Name</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Description</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending && rotations.length === 0 ? (
                <tr className="border-b border-clay-border">
                  <td colSpan={4} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : rotations.length > 0 ? (
                rotations.map((r) => (
                  <tr key={String(r._id)} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50">
                    <td className="px-4 py-2.5 text-[13px] font-medium text-clay-ink">
                      {r.name}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-clay-ink-muted">
                      {r.description || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <ClayBadge tone={r.is_active ? 'green' : 'neutral'}>
                        {r.is_active ? 'active' : 'inactive'}
                      </ClayBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/hrm/payroll/shift-rotations/${r._id}`}>
                          <ClayButton variant="pill" size="icon" aria-label="Edit rotation">
                            <Edit className="h-4 w-4" />
                          </ClayButton>
                        </Link>
                        <ClayButton
                          variant="pill"
                          size="icon"
                          aria-label="Delete rotation"
                          onClick={() => handleDelete(r._id)}
                        >
                          <Trash2 className="h-4 w-4 text-clay-red" />
                        </ClayButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-clay-border">
                  <td colSpan={4} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    No rotations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
