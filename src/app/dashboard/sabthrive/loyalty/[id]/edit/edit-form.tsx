'use client';

/**
 * Client form island for the edit loyalty program page. Posts to
 * `updateLoyaltyProgram`, grouped into sectioned Cards that mirror the
 * create form.
 */

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Award, Coins, Gift, Save } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';

import { updateLoyaltyProgram } from '@/app/actions/crm-loyalty.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" iconLeft={Save} loading={pending}>
      Save changes
    </Button>
  );
}

export function EditLoyaltyForm({
  loyaltyId,
  initial,
}: {
  loyaltyId: string;
  initial: Record<string, any>;
}): React.JSX.Element {
  const [state, formAction] = useActionState(updateLoyaltyProgram, initialState);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) {
      toast.success({
        title: 'Program updated',
        description: state.message,
      });
      router.push(`/dashboard/sabthrive/loyalty/${loyaltyId}`);
    }
    if (state.error) {
      toast.error({ title: 'Could not save changes', description: state.error });
    }
  }, [state, router, toast, loyaltyId]);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--st-space-4)]"
    >
      <input type="hidden" name="loyaltyId" value={loyaltyId} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--st-space-2)]">
            <Award className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Program basics</CardTitle>
          </div>
          <CardDescription>Name, status, and internal notes.</CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-[var(--st-space-4)]">
          <Field label="Program name" required>
            <Input
              name="name"
              required
              defaultValue={(initial.name as string) || ''}
              maxLength={120}
            />
          </Field>
          <Field label="Status">
            <EnumFormField
              enumName="loyaltyStatus"
              name="status"
              initialId={(initial.status as string) || 'active'}
            />
          </Field>
          <Field label="Notes" help="Visible to your team only.">
            <Textarea
              name="notes"
              defaultValue={(initial.notes as string) || ''}
              maxLength={500}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--st-space-2)]">
            <Coins className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Earning &amp; redemption</CardTitle>
          </div>
          <CardDescription>
            How customers earn points and what they are worth.
          </CardDescription>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
          <Field label="Points per ₹1 spent">
            <Input
              name="pointsPerCurrencyUnit"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial.pointsPerCurrencyUnit ?? 1}
            />
          </Field>
          <Field label="Points per ₹1 redeemed" help="Points needed to redeem ₹1.">
            <Input
              name="redemptionRatio"
              type="number"
              min={1}
              step={1}
              defaultValue={initial.redemptionRatio ?? 100}
            />
          </Field>
          <Field label="Minimum redemption" help="Optional points floor before redeeming.">
            <Input
              name="minRedemptionPoints"
              type="number"
              min={0}
              step={1}
              defaultValue={initial.minRedemptionPoints ?? ''}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--st-space-2)]">
            <Gift className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Welcome &amp; expiry</CardTitle>
          </div>
          <CardDescription>Signup reward and point lifetime.</CardDescription>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
          <Field label="Welcome bonus" help="Points awarded on signup.">
            <Input
              name="welcomeBonus"
              type="number"
              min={0}
              step={1}
              defaultValue={initial.welcomeBonus ?? ''}
            />
          </Field>
          <Field label="Points expiry (days)" help="Leave empty for points that never expire.">
            <Input
              name="expiryDays"
              type="number"
              min={1}
              step={1}
              defaultValue={initial.expiryDays ?? ''}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-[var(--st-space-2)]">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/dashboard/sabthrive/loyalty/${loyaltyId}`)}
        >
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
