'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import {
  Save,
  LoaderCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Update-yield dialog target — preserved route per §1D scope notes.
 *
 * Captures actual yield, scrap, status transition (default → completed)
 * and notes. Submits to `updateProductionOrderYield`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { updateProductionOrderYield } from '@/app/actions/crm-production-orders.actions';


const initialState: { message?: string; error?: string } = {};
export default function UpdateYieldPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [state, formAction, isPending] = useActionState(updateProductionOrderYield, initialState);
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
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title="Update yield"
      back={{ href: `/dashboard/crm/inventory/production-orders/${orderId}`, label: 'Back to order' }}
    >
      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="actualYield">Actual yield *</Label>
              <Input
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
              <Label htmlFor="scrap">Scrap</Label>
              <Input
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
            <Label htmlFor="status">Status</Label>
            <EnumFormField
              enumName="productionOrderStatus"
              name="status"
              initialId="completed"
              placeholder="Select status"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Downtime reasons, scrap notes, quality remarks…"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Update yield
            </Button>
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
