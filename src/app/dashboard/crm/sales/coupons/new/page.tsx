'use client';

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
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  Save,
  LoaderCircle,
  TicketPercent } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { saveCoupon } from '@/app/actions/crm-coupons.actions';

export const dynamic = 'force-dynamic';

type CouponType = 'percent' | 'flat' | 'bogo' | 'free_shipping';

const COUPON_TYPES: { value: CouponType; label: string }[] = [
  { value: 'percent', label: 'Percentage Discount' },
  { value: 'flat', label: 'Flat Amount Off' },
  { value: 'bogo', label: 'Buy One Get One (BOGO)' },
  { value: 'free_shipping', label: 'Free Shipping' },
];

function valueLabelForType(type: CouponType): string | null {
  if (type === 'percent') return 'Discount %';
  if (type === 'flat') return 'Flat Amount (₹)';
  return null;
}

const initialState = { message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save coupon'}
    </ZoruButton>
  );
}

export default function NewCouponPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveCoupon, initialState);
  const [couponType, setCouponType] = useState<CouponType>('percent');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Coupon created', description: state.message });
      router.push('/dashboard/crm/sales/coupons');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const valueLabel = valueLabelForType(couponType);
  const showValueField = valueLabel !== null;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Coupon"
        subtitle="Create a promo code, BOGO offer or free-shipping voucher."
        icon={TicketPercent}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/sales/coupons">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Hidden type field for ZoruSelect (controlled) */}
          <input type="hidden" name="type" value={couponType} />

          {/* Coupon Code */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="code">
              Coupon Code <span className="text-red-500">*</span>
            </ZoruLabel>
            <ZoruInput
              id="code"
              name="code"
              type="text"
              placeholder="e.g. SAVE20"
              required
              className="max-w-xs uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={50}
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="type-select">Type</ZoruLabel>
            <ZoruSelect
              value={couponType}
              onValueChange={(v) => setCouponType(v as CouponType)}
            >
              <ZoruSelectTrigger id="type-select" className="w-full max-w-xs">
                <ZoruSelectValue placeholder="Select type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {COUPON_TYPES.map((t) => (
                  <ZoruSelectItem key={t.value} value={t.value}>
                    {t.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          {/* Value — only shown for percent / flat */}
          {showValueField && (
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="value">{valueLabel}</ZoruLabel>
              <ZoruInput
                id="value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                placeholder={couponType === 'percent' ? 'e.g. 20' : 'e.g. 100'}
                className="max-w-xs"
              />
            </div>
          )}

          {/* Min Cart Value */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="minCart">Min Cart Value (₹)</ZoruLabel>
            <ZoruInput
              id="minCart"
              name="minCart"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 500 (optional)"
              className="max-w-xs"
            />
          </div>

          {/* Max Total Uses */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="maxUses">Max Total Uses</ZoruLabel>
            <ZoruInput
              id="maxUses"
              name="maxUses"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 100 (optional)"
              className="max-w-xs"
            />
          </div>

          {/* Per Customer Limit */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="perCustomerLimit">Per Customer Limit</ZoruLabel>
            <ZoruInput
              id="perCustomerLimit"
              name="perCustomerLimit"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 1 (optional)"
              className="max-w-xs"
            />
          </div>

          {/* Valid From */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="validFrom">Valid From</ZoruLabel>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Valid To */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="validTo">Valid To</ZoruLabel>
            <input
              id="validTo"
              name="validTo"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any internal notes about this coupon…"
              className="max-w-lg"
            />
          </div>

          {state.error && (
            <p className="text-[13px] text-red-500">{state.error}</p>
          )}

          <div className="flex items-center gap-3">
            <SubmitButton />
            <ZoruButton variant="ghost" size="sm" asChild>
              <Link href="/dashboard/crm/sales/coupons">Cancel</Link>
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
