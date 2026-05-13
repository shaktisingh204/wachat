'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, TrendingUp } from 'lucide-react';
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
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

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
      Save deal
    </ZoruButton>
  );
}

export default function NewDealPage() {
  const [state, formAction] = useActionState(createCrmDeal, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Deal created', description: state.message });
      router.push('/dashboard/crm/sales-crm/deals');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Deal"
        subtitle="Create a sales opportunity in your pipeline."
        icon={TrendingUp}
        actions={
          <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
            <Link href="/dashboard/crm/sales-crm/deals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Deal Name + Stage */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="name">Deal Name *</ZoruLabel>
              <ZoruInput id="name" name="name" placeholder="e.g. Acme Corp – Enterprise Plan" required />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="stage">Stage *</ZoruLabel>
              <ZoruSelect name="stage" defaultValue="Prospecting">
                <ZoruSelectTrigger id="stage">
                  <ZoruSelectValue placeholder="Select stage" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="Prospecting">Prospecting</ZoruSelectItem>
                  <ZoruSelectItem value="Qualification">Qualification</ZoruSelectItem>
                  <ZoruSelectItem value="Proposal">Proposal</ZoruSelectItem>
                  <ZoruSelectItem value="Negotiation">Negotiation</ZoruSelectItem>
                  <ZoruSelectItem value="Closed Won">Closed Won</ZoruSelectItem>
                  <ZoruSelectItem value="Closed Lost">Closed Lost</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 2: Value + Currency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="value">Deal Value *</ZoruLabel>
              <ZoruInput
                id="value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
              <EntityFormField entity="currency" name="currency" initialId="INR" />
            </div>
          </div>

          {/* Row 3: Close Date + Probability */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="closeDate">Expected Close Date</ZoruLabel>
              <ZoruInput id="closeDate" name="closeDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="probability">Win Probability (%)</ZoruLabel>
              <ZoruInput
                id="probability"
                name="probability"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 60"
              />
            </div>
          </div>

          {/* Row 4: Lead Source + Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="leadSource">Lead Source</ZoruLabel>
              <EntityFormField entity="leadSource" name="leadSource" placeholder="Select source" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="priority">Priority</ZoruLabel>
              <ZoruSelect name="priority">
                <ZoruSelectTrigger id="priority">
                  <ZoruSelectValue placeholder="Select priority" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                  <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                  <ZoruSelectItem value="High">High</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 5: Next Step */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="nextStep">Next Step</ZoruLabel>
            <ZoruInput id="nextStep" name="nextStep" placeholder="e.g. Schedule demo call" />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
