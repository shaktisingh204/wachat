'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Save,
  LoaderCircle,
  } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { saveAwardProgram } from '@/app/actions/crm-awards.actions';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save program
    </ZoruButton>
  );
}

export default function NewAwardProgramPage() {
  const [state, formAction] = useActionState(saveAwardProgram, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/hrm/hr/awards');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityListShell
      title="New Award Program"
      subtitle="Define a recognition cycle with nominations and winners."
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Program Name */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="name">Program Name *</ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              placeholder="e.g. Employee of the Month"
              required
            />
          </div>

          {/* Row 2: Program Type + Frequency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="programType">Program Type</ZoruLabel>
              <select
                id="programType"
                name="programType"
                defaultValue="recognition"
                className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-[13px] text-zoru-ink shadow-sm focus:outline-none focus:ring-1 focus:ring-zoru-accent"
              >
                <option value="recognition">Recognition</option>
                <option value="performance">Performance</option>
                <option value="innovation">Innovation</option>
                <option value="teamwork">Teamwork</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="frequency">Frequency</ZoruLabel>
              <select
                id="frequency"
                name="frequency"
                defaultValue="monthly"
                className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-[13px] text-zoru-ink shadow-sm focus:outline-none focus:ring-1 focus:ring-zoru-accent"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>

          {/* Row 3: Period Start + Period End */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="periodStart">Period Start</ZoruLabel>
              <ZoruInput id="periodStart" name="periodStart" type="date" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="periodEnd">Period End</ZoruLabel>
              <ZoruInput id="periodEnd" name="periodEnd" type="date" />
            </div>
          </div>

          {/* Row 4: Points Value + Cash Value */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="pointsValue">Points Value</ZoruLabel>
              <ZoruInput
                id="pointsValue"
                name="pointsValue"
                type="number"
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="cashValue">Cash Value (₹)</ZoruLabel>
              <ZoruInput
                id="cashValue"
                name="cashValue"
                type="number"
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
          </div>

          {/* Row 5: Criteria */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="criteria">Selection Criteria</ZoruLabel>
            <ZoruTextarea
              id="criteria"
              name="criteria"
              placeholder="How are nominees evaluated and winners chosen?"
              rows={3}
            />
          </div>

          {/* Row 6: Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="Additional details about this award program"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </EntityListShell>
  );
}
