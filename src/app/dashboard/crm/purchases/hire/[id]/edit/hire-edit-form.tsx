'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * Client island for the hire edit page. Wraps `updateCrmHire` in
 * `useActionState`, surfaces toasts on success/error, and pushes the
 * user back to the hire detail view on save.
 */

import { updateCrmHire } from '@/app/actions/crm-hire.actions';

export interface HireEditFormInitial {
  title: string;
  category: string;
  vendorCandidate: string;
  requiredBy: string;
  quantity: string;
  estimatedBudget: string;
  specs: string;
  owner: string;
  stage: string;
  status: string;
}

interface HireEditFormProps {
  hireId: string;
  initial: HireEditFormInitial;
}

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
      Save changes
    </Button>
  );
}

export function HireEditForm({ hireId, initial }: HireEditFormProps) {
  const [state, formAction] = useActionState(updateCrmHire, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(`/dashboard/crm/purchases/hire/${hireId}`);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, hireId]);

  return (
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="hireId" value={hireId} />

        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={initial.title}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              defaultValue={initial.category}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendorCandidate">Vendor candidate</Label>
            <Input
              id="vendorCandidate"
              name="vendorCandidate"
              defaultValue={initial.vendorCandidate}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="requiredBy">Required by</Label>
            <Input
              id="requiredBy"
              name="requiredBy"
              type="date"
              defaultValue={initial.requiredBy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initial.quantity}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="estimatedBudget">Estimated budget</Label>
            <Input
              id="estimatedBudget"
              name="estimatedBudget"
              type="number"
              min="0"
              step="1"
              defaultValue={initial.estimatedBudget}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              name="owner"
              defaultValue={initial.owner}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stage">Stage</Label>
            <Input
              id="stage"
              name="stage"
              defaultValue={initial.stage}
              placeholder="sourcing, quotes_received, negotiating, awarded, closed_lost"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              name="status"
              defaultValue={initial.status}
              placeholder="open, closed"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="specs">Specifications / scope</Label>
          <Textarea
            id="specs"
            name="specs"
            rows={4}
            defaultValue={initial.specs}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-4">
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            asChild
          >
            <Link href={`/dashboard/crm/purchases/hire/${hireId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Link>
          </Button>
          <SubmitButton />
        </div>
      </form>
    </Card>
  );
}
