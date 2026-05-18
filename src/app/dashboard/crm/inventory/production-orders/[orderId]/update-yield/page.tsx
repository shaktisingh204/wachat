'use client';

/**
 * Update-yield dialog target — preserved route per §1D scope notes.
 *
 * Captures actual yield, scrap, status transition (default → completed)
 * and notes. Submits to `updateProductionOrderYield`.
 */

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, Factory } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { updateProductionOrderYield } from '@/app/actions/crm-production-orders.actions';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Update yield
    </ZoruButton>
  );
}

export default function UpdateYieldPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [state, formAction] = useActionState(updateProductionOrderYield, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Updated', description: state.message });
      router.push(`/dashboard/crm/inventory/production-orders/${orderId}`);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router, orderId]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Update yield"
        subtitle="Record actual output, scrap and completion status for this order."
        icon={Factory}
        actions={
          <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
            <Link href={`/dashboard/crm/inventory/production-orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="actualYield">Actual yield *</ZoruLabel>
              <ZoruInput
                id="actualYield"
                name="actualYield"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="scrap">Scrap</ZoruLabel>
              <ZoruInput
                id="scrap"
                name="scrap"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <EnumFormField
              enumName="productionOrderStatus"
              name="status"
              initialId="completed"
              placeholder="Select status"
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Downtime reasons, scrap notes, quality remarks…"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
