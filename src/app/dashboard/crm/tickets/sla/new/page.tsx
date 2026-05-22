'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Save,
  LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveSla } from '@/app/actions/crm-sla.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string; id?: string } = {
  message: '',
  error: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save SLA
    </ZoruButton>
  );
}

export default function NewSlaPage() {
  const [state, formAction] = useActionState(saveSla, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/crm/tickets/sla');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="SLA POLICY"
      title="New SLA Policy"
      back={{ href: '/dashboard/crm/tickets/sla', label: 'SLA Policies' }}
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: SLA Name + Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="name">SLA Name</ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                placeholder="e.g. Critical 1-hour SLA"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Applies to Priority</ZoruLabel>
              <EnumFormField
                enumName="ticketPriorityWithAll"
                name="priority"
                initialId="medium"
                placeholder="Select priority"
              />
            </div>
          </div>

          {/* Row 2: First Response + Resolution */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="firstResponseMinutes">First Response (minutes)</ZoruLabel>
              <ZoruInput
                id="firstResponseMinutes"
                name="firstResponseMinutes"
                type="number"
                min="1"
                placeholder="e.g. 60"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="resolutionMinutes">Resolution (minutes)</ZoruLabel>
              <ZoruInput
                id="resolutionMinutes"
                name="resolutionMinutes"
                type="number"
                min="1"
                placeholder="e.g. 480"
                required
              />
            </div>
          </div>

          {/* Row 3: Business Hours Only (checkbox) */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="businessHoursOnly"
              name="businessHoursOnly"
              defaultChecked
              className="h-4 w-4 rounded border-zoru-line accent-zoru-primary"
            />
            <ZoruLabel htmlFor="businessHoursOnly" className="cursor-pointer">
              Business Hours Only
            </ZoruLabel>
          </div>

          {/* Row 4: Escalate After + Escalate To */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="escalateAfterMinutes">Escalate after (minutes)</ZoruLabel>
              <ZoruInput
                id="escalateAfterMinutes"
                name="escalateAfterMinutes"
                type="number"
                min="1"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="escalateTo">Escalate to (user)</ZoruLabel>
              <EntityFormField
                entity="user"
                name="escalateTo"
                placeholder="Select user"
              />
            </div>
          </div>

          {/* Row 5: Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="Optional description for this SLA policy"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </EntityDetailShell>
  );
}
