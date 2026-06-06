'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { savePurchaseLead } from '@/app/actions/crm-hire.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save request
    </Button>
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

      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Office Cleaning Services Q2"
              required
            />
          </div>

          {/* Row 2: Category + Vendor Candidate */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                placeholder="e.g. IT Services, Maintenance"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendorCandidate">Vendor Candidate</Label>
              <Input
                id="vendorCandidate"
                name="vendorCandidate"
                placeholder="Preferred vendor name"
              />
            </div>
          </div>

          {/* Row 3: Required By + Quantity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="requiredBy">Required By</Label>
              <Input id="requiredBy" name="requiredBy" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
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
              <Label htmlFor="estimatedBudget">Estimated Budget (₹)</Label>
              <Input
                id="estimatedBudget"
                name="estimatedBudget"
                type="number"
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner">Owner</Label>
              <Input id="owner" name="owner" placeholder="Requestor name" />
            </div>
          </div>

          {/* Row 5: Specs */}
          <div className="space-y-1.5">
            <Label htmlFor="specs">Specifications / Scope</Label>
            <Textarea
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
      </Card>
    </EntityListShell>
  );
}
