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
  useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';

import { updateCrmContact } from '@/app/actions/crm.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';

interface ContactInitial {
  _id: string;
  accountId: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: string;
  leadScore: number;
  linkedinUrl: string;
  twitterHandle: string;
  lifecycleStage: string;
  source: string;
  owner: string;
  tags: string[];
  dateOfBirth: string;
  timezone: string;
}

interface Props {
  initial: ContactInitial;
}

type ActionResult = {
  message?: string;
  error?: string;
  contactId?: string;
};

const initialState: ActionResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Save className="h-4 w-4" strokeWidth={1.75} />
      )}
      Save Changes
    </ZoruButton>
  );
}

export function EditContactForm({ initial }: Props) {
  const [state, formAction] = useActionState(
    updateCrmContact as unknown as (
      prev: ActionResult,
      formData: FormData,
    ) => Promise<ActionResult>,
    initialState,
  );
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      window.location.href = `/dashboard/crm/contacts/${state.contactId ?? initial._id}`;
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, initial._id]);

  return (
    <EntityDetailShell
      eyebrow="CONTACT"
      title={`Edit ${initial.name || 'Contact'}`}
      back={{
        href: `/dashboard/crm/contacts/${initial._id}`,
        label: 'Back to contact',
      }}
    >
      <form action={formAction}>
        <input type="hidden" name="contactId" value={initial._id} />

        <div className="space-y-6">
          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Identity</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Name, role, and salutation.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="name"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Full name <span className="text-zoru-danger">*</span>
                </ZoruLabel>
                <ZoruInput
                  id="name"
                  name="name"
                  required
                  defaultValue={initial.name}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="jobTitle"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Job title
                </ZoruLabel>
                <ZoruInput
                  id="jobTitle"
                  name="jobTitle"
                  defaultValue={initial.jobTitle}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                  Salutation
                </ZoruLabel>
                <EntityFormField
                  entity="salutation"
                  name="salutation"
                  initialId={null}
                  placeholder="Select salutation…"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="status"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Status
                </ZoruLabel>
                <ZoruSelect name="status" defaultValue={initial.status}>
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="new_lead">New lead</ZoruSelectItem>
                    <ZoruSelectItem value="contacted">Contacted</ZoruSelectItem>
                    <ZoruSelectItem value="qualified">Qualified</ZoruSelectItem>
                    <ZoruSelectItem value="unqualified">Unqualified</ZoruSelectItem>
                    <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                    <ZoruSelectItem value="imported">Imported</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Organisation</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Where this contact works.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                  Account
                </ZoruLabel>
                <EntityFormField
                  entity="account"
                  name="accountId"
                  initialId={initial.accountId}
                  placeholder="Select account…"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="company"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Company (free text)
                </ZoruLabel>
                <ZoruInput
                  id="company"
                  name="company"
                  defaultValue={initial.company}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">
                Contact channels
              </h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Email, phone, and social profiles.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="email"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Email <span className="text-zoru-danger">*</span>
                </ZoruLabel>
                <ZoruInput
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={initial.email}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="phone"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Phone
                </ZoruLabel>
                <ZoruInput
                  id="phone"
                  name="phone"
                  defaultValue={initial.phone}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="linkedinUrl"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  LinkedIn URL
                </ZoruLabel>
                <ZoruInput
                  id="linkedinUrl"
                  name="linkedinUrl"
                  defaultValue={initial.linkedinUrl}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="twitterHandle"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  X / Twitter handle
                </ZoruLabel>
                <ZoruInput
                  id="twitterHandle"
                  name="twitterHandle"
                  defaultValue={initial.twitterHandle}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Lifecycle</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Stage, source, and ownership.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="lifecycleStage"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Lifecycle stage
                </ZoruLabel>
                <ZoruSelect
                  name="lifecycleStage"
                  defaultValue={initial.lifecycleStage || 'lead'}
                >
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="lead">Lead</ZoruSelectItem>
                    <ZoruSelectItem value="mql">MQL</ZoruSelectItem>
                    <ZoruSelectItem value="sql">SQL</ZoruSelectItem>
                    <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                    <ZoruSelectItem value="evangelist">Evangelist</ZoruSelectItem>
                    <ZoruSelectItem value="other">Other</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="source"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Source
                </ZoruLabel>
                <ZoruSelect
                  name="source"
                  defaultValue={initial.source || 'other'}
                >
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="website">Website</ZoruSelectItem>
                    <ZoruSelectItem value="referral">Referral</ZoruSelectItem>
                    <ZoruSelectItem value="social">Social</ZoruSelectItem>
                    <ZoruSelectItem value="event">Event</ZoruSelectItem>
                    <ZoruSelectItem value="cold-outbound">Cold outbound</ZoruSelectItem>
                    <ZoruSelectItem value="ad">Ad</ZoruSelectItem>
                    <ZoruSelectItem value="other">Other</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="leadScore"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Lead score
                </ZoruLabel>
                <ZoruInput
                  id="leadScore"
                  name="leadScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={initial.leadScore}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                  Owner
                </ZoruLabel>
                <EntityFormField
                  entity="user"
                  name="owner"
                  initialId={initial.owner || null}
                  placeholder="Select owner…"
                />
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">
                Tags &amp; locale
              </h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Comma-separated tags, birthday, timezone.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <ZoruLabel
                  htmlFor="tags"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Tags
                </ZoruLabel>
                <ZoruInput
                  id="tags"
                  name="tags"
                  defaultValue={initial.tags.join(', ')}
                  placeholder="vip, hot, q1-target"
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="dateOfBirth"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Date of birth
                </ZoruLabel>
                <ZoruInput
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={initial.dateOfBirth}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                  Timezone
                </ZoruLabel>
                <EntityFormField
                  entity="timezone"
                  name="timezone"
                  initialId={initial.timezone || null}
                  placeholder="Select timezone…"
                />
              </div>
            </div>
          </ZoruCard>

          <div className="flex justify-end gap-2 border-t border-zoru-line pt-4">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = `/dashboard/crm/contacts/${initial._id}`;
              }}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </div>
        </div>
      </form>
    </EntityDetailShell>
  );
}
