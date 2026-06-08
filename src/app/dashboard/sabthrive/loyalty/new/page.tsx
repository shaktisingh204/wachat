'use client';

/**
 * New loyalty program — `/dashboard/sabthrive/loyalty/new`.
 *
 * A focused single-column form, grouped into sectioned Cards:
 *   - Program basics (name, notes)
 *   - Earning & redemption (points per unit, redemption ratio, minimum)
 *   - Welcome & expiry (signup bonus, points expiry)
 * Submits the `saveLoyaltyProgram` server action via useActionState.
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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveLoyaltyProgram } from '@/app/actions/crm-loyalty.actions';

const initialState = { message: '', error: '' };

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" iconLeft={Save} loading={pending}>
      Save program
    </Button>
  );
}

export default function NewLoyaltyProgramPage(): React.JSX.Element {
  const [state, formAction] = useActionState(saveLoyaltyProgram, initialState);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) {
      toast.success({
        title: 'Program created',
        description: state.message,
      });
      router.push('/dashboard/sabthrive/loyalty');
    }
    if (state.error) {
      toast.error({ title: 'Could not save program', description: state.error });
    }
  }, [state, router, toast]);

  return (
    <EntityDetailShell
      eyebrow="Loyalty"
      title="New program"
      back={{ href: '/dashboard/sabthrive/loyalty', label: 'Loyalty' }}
    >
      <form action={formAction} className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--st-space-4)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-[var(--st-space-2)]">
              <Award className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
              <CardTitle>Program basics</CardTitle>
            </div>
            <CardDescription>Name your program and add internal notes.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-[var(--st-space-4)]">
            <Field label="Program name" required>
              <Input name="name" required placeholder="Gold rewards" maxLength={120} />
            </Field>
            <Field label="Notes" help="Visible to your team only.">
              <Textarea
                name="notes"
                placeholder="Context for this loyalty program, eligibility rules, or launch dates."
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
              Set how customers earn points and what those points are worth.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
            <Field label="Points per ₹1 spent">
              <Input
                name="pointsPerCurrencyUnit"
                type="number"
                min={0}
                step="0.01"
                defaultValue={1}
              />
            </Field>
            <Field label="Points per ₹1 redeemed" help="Points needed to redeem ₹1.">
              <Input
                name="redemptionRatio"
                type="number"
                min={1}
                step={1}
                defaultValue={100}
              />
            </Field>
            <Field label="Minimum redemption" help="Optional points floor before redeeming.">
              <Input
                name="minRedemptionPoints"
                type="number"
                min={0}
                step={1}
                placeholder="Optional"
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
            <CardDescription>
              Reward signups and decide whether points expire.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
            <Field label="Welcome bonus" help="Points awarded on signup.">
              <Input
                name="welcomeBonus"
                type="number"
                min={0}
                step={1}
                placeholder="Optional"
              />
            </Field>
            <Field label="Points expiry (days)" help="Leave empty for points that never expire.">
              <Input
                name="expiryDays"
                type="number"
                min={1}
                step={1}
                placeholder="Never"
              />
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-[var(--st-space-2)]">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/dashboard/sabthrive/loyalty')}
          >
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </form>
    </EntityDetailShell>
  );
}
