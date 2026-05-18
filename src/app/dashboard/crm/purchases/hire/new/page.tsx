'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { savePurchaseLead } from '@/app/actions/crm-hire.actions';

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
      Save request
    </ZoruButton>
  );
}

export default function NewHireRequestPage() {
  const [state, formAction] = useActionState(savePurchaseLead, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/crm/purchases/hire');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityListShell
      title="New Hire Request"
      subtitle="Create a vendor sourcing or service hiring request."
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Title */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="title">Title *</ZoruLabel>
            <ZoruInput
              id="title"
              name="title"
              placeholder="e.g. Office Cleaning Services Q2"
              required
            />
          </div>

          {/* Row 2: Category + Vendor Candidate */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="category">Category</ZoruLabel>
              <ZoruInput
                id="category"
                name="category"
                placeholder="e.g. IT Services, Maintenance"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="vendorCandidate">Vendor Candidate</ZoruLabel>
              <ZoruInput
                id="vendorCandidate"
                name="vendorCandidate"
                placeholder="Preferred vendor name"
              />
            </div>
          </div>

          {/* Row 3: Required By + Quantity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="requiredBy">Required By</ZoruLabel>
              <ZoruInput id="requiredBy" name="requiredBy" type="date" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="quantity">Quantity</ZoruLabel>
              <ZoruInput
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 1 (months, units, etc.)"
              />
            </div>
          </div>

          {/* Row 4: Estimated Budget + Owner */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="estimatedBudget">Estimated Budget (₹)</ZoruLabel>
              <ZoruInput
                id="estimatedBudget"
                name="estimatedBudget"
                type="number"
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
              <ZoruInput id="owner" name="owner" placeholder="Requestor name" />
            </div>
          </div>

          {/* Row 5: Specs */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="specs">Specifications / Scope</ZoruLabel>
            <ZoruTextarea
              id="specs"
              name="specs"
              placeholder="Describe the scope, requirements, or deliverables"
              rows={4}
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
