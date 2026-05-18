'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput, ZoruLabel } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { Edit,
  Play,
  Plus,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell
      title="Shift Rotations"
      subtitle="Define cyclical shift sequences to automate assignment."
      primaryAction={
        <Link href="/dashboard/crm/hr-payroll/shift-rotations/automate">
          <ZoruButton>
            <Play className="h-4 w-4" strokeWidth={1.75} />
            Automate Shift
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">Create Rotation</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
          <div className="flex flex-col gap-1.5">
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">Name</ZoruLabel>
            <ZoruInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="2-2-3 rotation"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">Description</ZoruLabel>
            <ZoruInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-end">
            <ZoruButton
              type="submit"
              disabled={pending}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Add
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">All Rotations</h2>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Name</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Description</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending && rotations.length === 0 ? (
                <tr className="border-b border-zoru-line">
                  <td colSpan={4} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading…
                  </td>
                </tr>
              ) : rotations.length > 0 ? (
                rotations.map((r) => (
                  <tr key={String(r._id)} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                    <td className="px-4 py-2.5 text-[13px] font-medium text-zoru-ink">
                      {r.name}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-zoru-ink-muted">
                      {r.description || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <ZoruBadge variant={r.is_active ? 'success' : 'secondary'}>
                        {r.is_active ? 'active' : 'inactive'}
                      </ZoruBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/crm/hr-payroll/shift-rotations/${r._id}`}>
                          <ZoruButton variant="outline" size="icon" aria-label="Edit rotation">
                            <Edit className="h-4 w-4" />
                          </ZoruButton>
                        </Link>
                        <ZoruButton
                          variant="outline"
                          size="icon"
                          aria-label="Delete rotation"
                          onClick={() => handleDelete(r._id)}
                        >
                          <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                        </ZoruButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-zoru-line">
                  <td colSpan={4} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No rotations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
