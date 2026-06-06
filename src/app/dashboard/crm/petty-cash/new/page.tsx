'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { savePettyCashFloat } from '@/app/actions/crm-petty-cash.actions';
import { useRouter } from 'next/navigation';

const BASE = '/dashboard/crm/petty-cash';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Creating…' : 'Create float'}
    </Button>
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
      const dest = state.id ? `${BASE}/${state.id}` : BASE;
      router.push(dest);
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="PETTY CASH"
      title="New Petty Cash Float"
      back={{ href: BASE, label: 'Petty Cash' }}
    >
      <Card className="p-6">
        <form action={formAction} className="grid gap-5 md:grid-cols-2">

          {/* Float name */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="name">
              Float name <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Mumbai HQ petty cash"
              className="h-10"
            />
          </div>

          {/* Branch name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branchName">
              Branch <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="branchName"
              name="branchName"
              required
              placeholder="e.g. Mumbai HQ"
              className="h-10"
            />
          </div>

          {/* Custodian name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custodianName">Custodian</Label>
            <Input
              id="custodianName"
              name="custodianName"
              placeholder="Person responsible for this float"
              className="h-10"
            />
          </div>

          {/* Opening Balance */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              name="openingBalance"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="h-10"
            />
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              placeholder="INR"
              defaultValue="INR"
              maxLength={6}
              className="h-10"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Operating policies, signing limits, custodian handover notes."
              rows={3}
            />
          </div>

          {/* Inline error / success */}
          {state?.error ? (
            <p className="text-[13px] text-zoru-danger-ink md:col-span-2">
              {state.error}
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={BASE}>Cancel</Link>
            </Button>
            <SubmitButton />
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
