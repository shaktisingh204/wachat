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
import { saveDisciplinaryCase } from '@/app/actions/crm-disciplinary.actions';

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
      Save case
    </ZoruButton>
  );
}

export default function NewDisciplinaryCasePage() {
  const [state, formAction] = useActionState(saveDisciplinaryCase, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/hrm/hr/disciplinary');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityListShell
      title="New Disciplinary Case"
      subtitle="Open a confidential disciplinary case for an employee."
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Employee Name */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="employeeName">Employee Name *</ZoruLabel>
            <ZoruInput
              id="employeeName"
              name="employeeName"
              placeholder="Full name of the employee"
              required
            />
          </div>

          {/* Row 2: Case Type + Severity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="caseType">Case Type</ZoruLabel>
              <select
                id="caseType"
                name="caseType"
                defaultValue="misconduct"
                className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-[13px] text-zoru-ink shadow-sm focus:outline-none focus:ring-1 focus:ring-zoru-accent"
              >
                <option value="misconduct">Misconduct</option>
                <option value="performance">Performance</option>
                <option value="attendance">Attendance</option>
                <option value="harassment">Harassment</option>
                <option value="policy_violation">Policy Violation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="severity">Severity</ZoruLabel>
              <select
                id="severity"
                name="severity"
                defaultValue="minor"
                className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-[13px] text-zoru-ink shadow-sm focus:outline-none focus:ring-1 focus:ring-zoru-accent"
              >
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
                <option value="gross_misconduct">Gross Misconduct</option>
              </select>
            </div>
          </div>

          {/* Row 3: Raised By + Incident Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="raisedBy">Raised By</ZoruLabel>
              <ZoruInput
                id="raisedBy"
                name="raisedBy"
                placeholder="Manager or HR officer name"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="incidentDate">Incident Date</ZoruLabel>
              <ZoruInput id="incidentDate" name="incidentDate" type="date" />
            </div>
          </div>

          {/* Row 4: Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="Describe the incident or issue in detail"
              rows={4}
            />
          </div>

          {/* Row 5: Notes */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes">Initial Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Any initial observations or action items"
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
