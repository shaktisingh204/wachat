'use client';

import { useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Factory, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { saveProductionOrder } from '@/app/actions/crm-production-orders.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

export const dynamic = 'force-dynamic';

const initialState = { message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save order
    </ZoruButton>
  );
}

export default function NewProductionOrderPage() {
  const [state, formAction] = useActionState(saveProductionOrder, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/crm/inventory/production-orders');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <form action={formAction}>
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="New Production Order"
          subtitle="Create a manufacturing job card from a BOM to track production."
          icon={Factory}
          actions={
            <div className="flex items-center gap-2">
              <ZoruButton variant="outline" size="sm" asChild>
                <Link href="/dashboard/crm/inventory/production-orders">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </ZoruButton>
              <SubmitButton />
            </div>
          }
        />

        <ZoruCard className="p-6">
          <h2 className="mb-4 text-[16px] text-zoru-ink">Order Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ZoruLabel htmlFor="orderNo" className="text-xs text-zoru-ink">
                Order No.
              </ZoruLabel>
              <ZoruInput
                id="orderNo"
                name="orderNo"
                placeholder="Auto-generated"
                className="h-9"
                maxLength={64}
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="bomRef" className="text-xs text-zoru-ink">
                BOM Reference
              </ZoruLabel>
              <ZoruInput
                id="bomRef"
                name="bomRef"
                placeholder="BOM ID or number"
                className="h-9"
                maxLength={64}
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="finishedGoodName" className="text-xs text-zoru-ink">
                Finished Good *
              </ZoruLabel>
              <EntityFormField
                entity="item"
                name="finishedGoodId"
                dualWriteName="finishedGoodName"
                required
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="plannedQty" className="text-xs text-zoru-ink">
                Planned Qty *
              </ZoruLabel>
              <ZoruInput
                id="plannedQty"
                name="plannedQty"
                type="number"
                required
                min={0}
                step="any"
                placeholder="e.g. 100"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="unit" className="text-xs text-zoru-ink">
                Unit
              </ZoruLabel>
              <EntityFormField
                entity="unit"
                name="unit"
                placeholder="e.g. PCS / KG"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="plannedStart" className="text-xs text-zoru-ink">
                Planned Start
              </ZoruLabel>
              <ZoruInput
                id="plannedStart"
                name="plannedStart"
                type="datetime-local"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="plannedEnd" className="text-xs text-zoru-ink">
                Planned End
              </ZoruLabel>
              <ZoruInput
                id="plannedEnd"
                name="plannedEnd"
                type="datetime-local"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="machineId" className="text-xs text-zoru-ink">
                Machine / Line
              </ZoruLabel>
              <ZoruInput
                id="machineId"
                name="machineId"
                placeholder="e.g. Line A"
                className="h-9"
                maxLength={100}
              />
            </div>

            <div className="space-y-1">
              <ZoruLabel htmlFor="machineOperator" className="text-xs text-zoru-ink">
                Operator
              </ZoruLabel>
              <EntityFormField
                entity="employee"
                name="machineOperatorId"
                dualWriteName="machineOperator"
                placeholder="Operator"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <ZoruLabel htmlFor="notes" className="text-xs text-zoru-ink">
                Notes
              </ZoruLabel>
              <ZoruTextarea
                id="notes"
                name="notes"
                placeholder="Any additional notes…"
                rows={3}
              />
            </div>
          </div>
        </ZoruCard>
      </div>
    </form>
  );
}
