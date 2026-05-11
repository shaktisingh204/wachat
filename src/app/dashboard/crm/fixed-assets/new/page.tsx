'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';
import { saveFixedAsset } from '@/app/actions/crm-fixed-assets.actions';

export const dynamic = 'force-dynamic';

const DATE_CLASS =
  'flex h-10 w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save asset'}
    </ZoruButton>
  );
}

const initialState = { message: '', error: '' };

export default function NewFixedAssetPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveFixedAsset, initialState);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Asset saved', description: state.message });
      router.push('/dashboard/crm/fixed-assets');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Fixed Asset"
        subtitle="Register a capital asset and set up its depreciation schedule."
        icon={Building2}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/fixed-assets">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        }
      />

      <form action={formAction} className="flex flex-col gap-6">
        {/* ── Card 1: Asset Details ── */}
        <ZoruCard className="p-6">
          <h2 className="mb-5 text-[15px] font-medium text-zoru-ink">Asset Details</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {/* Asset Code */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="assetCode">Asset Code</ZoruLabel>
              <ZoruInput
                id="assetCode"
                name="assetCode"
                placeholder="Auto-generated"
                className="h-10"
              />
            </div>

            {/* Asset Name */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="name">
                Asset Name <span className="text-red-500">*</span>
              </ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                placeholder="e.g. Office Laptop"
                required
                className="h-10"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="category">Category</ZoruLabel>
              <ZoruInput
                id="category"
                name="category"
                placeholder="e.g. IT Equipment"
                className="h-10"
              />
            </div>

            {/* Purchase Date */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="purchaseDate">Purchase Date</ZoruLabel>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                className={DATE_CLASS}
              />
            </div>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="supplierName">Supplier</ZoruLabel>
              <ZoruInput
                id="supplierName"
                name="supplierName"
                placeholder="e.g. Dell India Pvt Ltd"
                className="h-10"
              />
            </div>

            {/* Purchase Cost */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="cost">
                Purchase Cost ₹ <span className="text-red-500">*</span>
              </ZoruLabel>
              <ZoruInput
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 85000"
                required
                className="h-10"
              />
            </div>

            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="location">Location</ZoruLabel>
              <ZoruInput
                id="location"
                name="location"
                placeholder="e.g. Mumbai HQ – Floor 3"
                className="h-10"
              />
            </div>

            {/* Custodian */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="custodianName">Custodian</ZoruLabel>
              <ZoruInput
                id="custodianName"
                name="custodianName"
                placeholder="e.g. Ravi Sharma"
                className="h-10"
              />
            </div>
          </div>
        </ZoruCard>

        {/* ── Card 2: Depreciation ── */}
        <ZoruCard className="p-6">
          <h2 className="mb-5 text-[15px] font-medium text-zoru-ink">Depreciation</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {/* Depreciation Method */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="depreciationMethod">Depreciation Method</ZoruLabel>
              <ZoruSelect name="depreciationMethod" defaultValue="slm">
                <ZoruSelectTrigger id="depreciationMethod" className="h-10 w-full">
                  <ZoruSelectValue placeholder="Select method" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="slm">SLM – Straight Line</ZoruSelectItem>
                  <ZoruSelectItem value="wdv">WDV – Written Down Value</ZoruSelectItem>
                  <ZoruSelectItem value="units">Units of Production</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Useful Life */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="usefulLifeMonths">Useful Life (months)</ZoruLabel>
              <ZoruInput
                id="usefulLifeMonths"
                name="usefulLifeMonths"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 60"
                className="h-10"
              />
            </div>

            {/* Residual Value */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="residualValue">Residual Value ₹</ZoruLabel>
              <ZoruInput
                id="residualValue"
                name="residualValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="h-10"
              />
            </div>

            {/* Warranty Expiry */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="warrantyExpiry">Warranty Expiry</ZoruLabel>
              <input
                id="warrantyExpiry"
                name="warrantyExpiry"
                type="date"
                className={DATE_CLASS}
              />
            </div>

            {/* Insurance Expiry */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="insuranceExpiry">Insurance Expiry</ZoruLabel>
              <input
                id="insuranceExpiry"
                name="insuranceExpiry"
                type="date"
                className={DATE_CLASS}
              />
            </div>

            {/* Notes – full width */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
              <ZoruTextarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any additional remarks about this asset…"
              />
            </div>
          </div>
        </ZoruCard>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
