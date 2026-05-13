'use client';

import { useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { updateCrmStockAdjustment } from '@/app/actions/crm-inventory.actions';

const initialState = { message: '', error: '', adjustmentId: '' };

export interface AdjustmentEditFormProps {
  initial: {
    _id: string;
    reason: string;
    notes?: string;
    quantity: number;
    productName?: string;
    warehouseName?: string;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save changes
    </ZoruButton>
  );
}

export function AdjustmentEditForm({ initial }: AdjustmentEditFormProps) {
  const [state, formAction] = useActionState(updateCrmStockAdjustment, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push(`/dashboard/crm/inventory/adjustments/${initial._id}`);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router, initial._id]);

  return (
    <form action={formAction} className="flex w-full max-w-2xl flex-col gap-6">
      <input type="hidden" name="adjustmentId" value={initial._id} />

      <div className="flex items-center justify-between">
        <ZoruButton variant="outline" size="sm" asChild>
          <Link href={`/dashboard/crm/inventory/adjustments/${initial._id}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </ZoruButton>
        <SubmitButton />
      </div>

      <ZoruCard className="p-6">
        <div className="grid gap-4">
          {initial.productName ? (
            <div className="space-y-1">
              <ZoruLabel className="text-xs text-zoru-ink">Product</ZoruLabel>
              <ZoruInput defaultValue={initial.productName} disabled className="h-9" />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Product cannot be changed after the adjustment is recorded.
              </p>
            </div>
          ) : null}

          {initial.warehouseName ? (
            <div className="space-y-1">
              <ZoruLabel className="text-xs text-zoru-ink">Warehouse</ZoruLabel>
              <ZoruInput defaultValue={initial.warehouseName} disabled className="h-9" />
            </div>
          ) : null}

          <div className="space-y-1">
            <ZoruLabel className="text-xs text-zoru-ink">Quantity</ZoruLabel>
            <ZoruInput
              defaultValue={String(initial.quantity)}
              disabled
              className="h-9"
            />
            <p className="text-[11.5px] text-zoru-ink-muted">
              Quantity is locked. Create a new adjustment to correct stock.
            </p>
          </div>

          <div className="space-y-1">
            <ZoruLabel htmlFor="reason" className="text-xs text-zoru-ink">
              Reason *
            </ZoruLabel>
            <ZoruSelect name="reason" defaultValue={initial.reason} required>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Select reason" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="Stock Received">Stock Received</ZoruSelectItem>
                <ZoruSelectItem value="Inventory Count">Inventory Count</ZoruSelectItem>
                <ZoruSelectItem value="Damage">Damage</ZoruSelectItem>
                <ZoruSelectItem value="Theft">Theft</ZoruSelectItem>
                <ZoruSelectItem value="Loss">Loss</ZoruSelectItem>
                <ZoruSelectItem value="Return">Return</ZoruSelectItem>
                <ZoruSelectItem value="Other">Other</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div className="space-y-1">
            <ZoruLabel htmlFor="notes" className="text-xs text-zoru-ink">
              Notes
            </ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              defaultValue={initial.notes ?? ''}
              rows={3}
            />
          </div>
        </div>
      </ZoruCard>
    </form>
  );
}
