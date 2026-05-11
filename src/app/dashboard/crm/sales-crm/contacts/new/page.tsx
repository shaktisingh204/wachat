'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, Users } from 'lucide-react';
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
import { addCrmContact } from '@/app/actions/crm.actions';

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
      Save contact
    </ZoruButton>
  );
}

export default function NewContactPage() {
  const [state, formAction] = useActionState(addCrmContact, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Contact created', description: state.message });
      router.push('/dashboard/crm/sales-crm/contacts');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Contact"
        subtitle="Add a person to your CRM contact book."
        icon={Users}
        actions={
          <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
            <Link href="/dashboard/crm/sales-crm/contacts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Name + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="name">Full Name *</ZoruLabel>
              <ZoruInput id="name" name="name" placeholder="e.g. Priya Sharma" required />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="email">Email *</ZoruLabel>
              <ZoruInput id="email" name="email" type="email" placeholder="priya@example.com" required />
            </div>
          </div>

          {/* Row 2: Phone + Company */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
              <ZoruInput id="phone" name="phone" placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="company">Company</ZoruLabel>
              <ZoruInput id="company" name="company" placeholder="Company or organisation" />
            </div>
          </div>

          {/* Row 3: Job Title + Owner */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="jobTitle">Job Title</ZoruLabel>
              <ZoruInput id="jobTitle" name="jobTitle" placeholder="e.g. VP Sales" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
              <ZoruInput id="owner" name="owner" placeholder="Sales rep name" />
            </div>
          </div>

          {/* Row 4: Status + Lifecycle Stage */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="status">Status</ZoruLabel>
              <ZoruSelect name="status" defaultValue="active">
                <ZoruSelectTrigger id="status">
                  <ZoruSelectValue placeholder="Select status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="active">Active</ZoruSelectItem>
                  <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                  <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="lifecycleStage">Lifecycle Stage</ZoruLabel>
              <ZoruSelect name="lifecycleStage">
                <ZoruSelectTrigger id="lifecycleStage">
                  <ZoruSelectValue placeholder="Select stage" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="subscriber">Subscriber</ZoruSelectItem>
                  <ZoruSelectItem value="lead">Lead</ZoruSelectItem>
                  <ZoruSelectItem value="marketing-qualified-lead">Marketing Qualified Lead</ZoruSelectItem>
                  <ZoruSelectItem value="sales-qualified-lead">Sales Qualified Lead</ZoruSelectItem>
                  <ZoruSelectItem value="opportunity">Opportunity</ZoruSelectItem>
                  <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                  <ZoruSelectItem value="evangelist">Evangelist</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 5: Lead Score + Source */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="leadScore">Lead Score</ZoruLabel>
              <ZoruInput
                id="leadScore"
                name="leadScore"
                type="number"
                min="0"
                max="100"
                defaultValue="0"
                placeholder="0–100"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="source">Source</ZoruLabel>
              <ZoruSelect name="source">
                <ZoruSelectTrigger id="source">
                  <ZoruSelectValue placeholder="Select source" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="website">Website</ZoruSelectItem>
                  <ZoruSelectItem value="referral">Referral</ZoruSelectItem>
                  <ZoruSelectItem value="social-media">Social Media</ZoruSelectItem>
                  <ZoruSelectItem value="cold-outreach">Cold Outreach</ZoruSelectItem>
                  <ZoruSelectItem value="event">Event</ZoruSelectItem>
                  <ZoruSelectItem value="other">Other</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 6: LinkedIn + Tags */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="linkedinUrl">LinkedIn URL</ZoruLabel>
              <ZoruInput id="linkedinUrl" name="linkedinUrl" placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
              <ZoruInput id="tags" name="tags" placeholder="Comma-separated tags" />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
