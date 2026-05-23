'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle,
  } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveCoupon } from '@/app/actions/crm-coupons.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

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
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save coupon'}
    </Button>
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
    <EntityDetailShell
      eyebrow="COUPON"
      title="New Coupon"
      back={{ href: '/dashboard/crm/sales/coupons', label: 'Coupons' }}
    >

      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Hidden type field for Select (controlled) */}
          <input type="hidden" name="type" value={couponType} />

          {/* Coupon Code */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">
              Coupon Code <span className="text-red-500">*</span>
            </Label>
            <Input
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
            <Label>Type</Label>
            <div className="w-full max-w-xs">
              <EnumFormField
                enumName="couponType"
                name="__type_picker"
                initialId={couponType}
                placeholder="Select type"
                onChange={(v) => setCouponType((v ?? 'percent') as CouponType)}
              />
            </div>
          </div>

          {/* Value — only shown for percent / flat */}
          {showValueField && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">{valueLabel}</Label>
              <Input
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
            <Label htmlFor="minCart">Min Cart Value (₹)</Label>
            <Input
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
            <Label htmlFor="maxUses">Max Total Uses</Label>
            <Input
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
            <Label htmlFor="perCustomerLimit">Per Customer Limit</Label>
            <Input
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
            <Label htmlFor="validFrom">Valid From</Label>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Valid To */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="validTo">Valid To</Label>
            <input
              id="validTo"
              name="validTo"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Applicable Categories */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="applicableCategories">Applicable Categories</Label>
            <Input
              id="applicableCategories"
              name="applicableCategories"
              type="text"
              placeholder="e.g. electronics, clothing (comma separated)"
              className="max-w-xs"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/crm/sales/coupons">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
