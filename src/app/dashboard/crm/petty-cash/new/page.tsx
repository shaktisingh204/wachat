'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { savePettyCashFloat } from '@/app/actions/crm-petty-cash.actions';
import { useRouter } from 'next/navigation';
import { EntityFormField } from '@/components/crm/entity-form-field';

export const dynamic = 'force-dynamic';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save float'}
    </ZoruButton>
  );
}

export default function NewPettyCashFloatPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(savePettyCashFloat, {
    message: '',
    error: '',
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Float created', description: state.message });
      router.push('/dashboard/crm/petty-cash');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="PETTY CASH"
      title="New Petty Cash Float"
      back={{ href: '/dashboard/crm/petty-cash', label: 'Petty Cash' }}
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="grid gap-5 md:grid-cols-2">
          {/* Branch */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Branch *</ZoruLabel>
            <EntityFormField
              entity="branch"
              name="branchId"
              dualWriteName="branchName"
              required
              placeholder="Select branch…"
            />
          </div>

          {/* Custodian */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Custodian</ZoruLabel>
            <EntityFormField
              entity="employee"
              name="custodianId"
              dualWriteName="custodianName"
              placeholder="Select custodian…"
            />
          </div>

          {/* Opening Balance */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="openingBalance">Opening Balance (₹)</ZoruLabel>
            <ZoruInput
              id="openingBalance"
              name="openingBalance"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="h-10"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <ZoruLabel htmlFor="notes">Notes (optional)</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Any remarks about this float…"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <ZoruButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </EntityDetailShell>
  );
}
