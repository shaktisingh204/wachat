'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getAwardProgramById,
  updateAwardProgram,
} from '@/app/actions/crm-awards.actions';

export const dynamic = 'force-dynamic';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-[13px] text-zoru-ink shadow-sm focus:outline-none focus:ring-1 focus:ring-zoru-accent';

const initialState: { message?: string; error?: string; id?: string } = {};

/** Coerce a stored Date / ISO string into a `YYYY-MM-DD` input value. */
function toDateInput(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save changes
    </Button>
  );
}

export default function EditAwardProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [program, setProgram] = useState<Record<string, unknown> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [, startLoad] = useTransition();

  const [state, formAction] = useActionState(
    updateAwardProgram.bind(null, programId),
    initialState,
  );

  useEffect(() => {
    startLoad(async () => {
      const doc = await getAwardProgramById(programId);
      if (!doc) {
        setLoadFailed(true);
        return;
      }
      setProgram(doc as Record<string, unknown>);
    });
  }, [programId]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(`/dashboard/hrm/hr/awards/${programId}`);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, programId]);

  if (loadFailed) {
    return (
      <EntityListShell
        title="Edit Award Program"
        subtitle="This program could not be found."
      >
        <Card className="p-6 text-[13px] text-zoru-ink-muted">
          The award program you are trying to edit does not exist or is no
          longer available.
        </Card>
      </EntityListShell>
    );
  }

  if (!program) {
    return (
      <EntityListShell title="Edit Award Program" subtitle="Loading…">
        <Card className="flex h-48 items-center justify-center p-6">
          <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
        </Card>
      </EntityListShell>
    );
  }

  const p = program;

  return (
    <EntityListShell
      title="Edit Award Program"
      subtitle="Update this recognition cycle."
    >
      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Program Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Program Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Employee of the Month"
              required
              defaultValue={String(p.name ?? '')}
            />
          </div>

          {/* Row 2: Program Type + Frequency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="programType">Program Type</Label>
              <select
                id="programType"
                name="programType"
                defaultValue={String(p.programType ?? p.type ?? 'recognition')}
                className={SELECT_CLASS}
              >
                <option value="recognition">Recognition</option>
                <option value="performance">Performance</option>
                <option value="innovation">Innovation</option>
                <option value="teamwork">Teamwork</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <select
                id="frequency"
                name="frequency"
                defaultValue={String(p.frequency ?? 'monthly')}
                className={SELECT_CLASS}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>

          {/* Row 3: Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={String(p.status ?? 'draft')}
              className={SELECT_CLASS}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Row 4: Period Start + Period End */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                name="periodStart"
                type="date"
                defaultValue={toDateInput(p.periodStart)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                name="periodEnd"
                type="date"
                defaultValue={toDateInput(p.periodEnd)}
              />
            </div>
          </div>

          {/* Row 5: Points Value + Cash Value */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pointsValue">Points Value</Label>
              <Input
                id="pointsValue"
                name="pointsValue"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                defaultValue={
                  typeof p.pointsValue === 'number' ? String(p.pointsValue) : ''
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cashValue">Cash Value (₹)</Label>
              <Input
                id="cashValue"
                name="cashValue"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                defaultValue={
                  typeof p.cashValue === 'number' ? String(p.cashValue) : ''
                }
              />
            </div>
          </div>

          {/* Row 6: Criteria */}
          <div className="space-y-1.5">
            <Label htmlFor="criteria">Selection Criteria</Label>
            <Textarea
              id="criteria"
              name="criteria"
              placeholder="How are nominees evaluated and winners chosen?"
              rows={3}
              defaultValue={String(p.criteria ?? '')}
            />
          </div>

          {/* Row 7: Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Additional details about this award program"
              rows={3}
              defaultValue={String(p.description ?? '')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(`/dashboard/hrm/hr/awards/${programId}`)
              }
            >
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </Card>
    </EntityListShell>
  );
}
