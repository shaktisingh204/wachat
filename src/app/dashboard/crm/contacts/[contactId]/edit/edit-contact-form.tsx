'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useOptimistic, startTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Save className="h-4 w-4" strokeWidth={1.75} />
      )}
      Save Changes
    </Button>
  );
}

export function EditContactForm({ initial }: Props) {
  const [optimisticState, addOptimisticState] = useOptimistic<
    ContactInitial,
    Partial<ContactInitial>
  >(initial, (state, update) => ({
    ...state,
    ...update,
  }));

  const [state, formAction] = useActionState(
    updateCrmContact as unknown as (
      prev: ActionResult,
      formData: FormData,
    ) => Promise<ActionResult>,
    initialState,
  );
  const { toast } = useToast();

  const router = useRouter();

  const handleAction = (formData: FormData) => {
    startTransition(() => {
      addOptimisticState({
        name: formData.get('name') as string || optimisticState.name,
        jobTitle: formData.get('jobTitle') as string || optimisticState.jobTitle,
        company: formData.get('company') as string || optimisticState.company,
        email: formData.get('email') as string || optimisticState.email,
        phone: formData.get('phone') as string || optimisticState.phone,
        status: formData.get('status') as string || optimisticState.status,
      });
    });
    startTransition(() => {
      formAction(formData);
    });
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(`/dashboard/crm/contacts/${state.contactId ?? initial._id}`);
      router.refresh();
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, initial._id, router]);

  return (
    <EntityDetailShell
      eyebrow="CONTACT"
      title={`Edit ${optimisticState.name || 'Contact'}`}
      back={{
        href: `/dashboard/crm/contacts/${initial._id}`,
        label: 'Back to contact',
      }}
    >
      <form action={handleAction}>
        <input type="hidden" name="contactId" value={initial._id} />

        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Identity</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Name, role, and salutation.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Full name <span className="text-[var(--st-danger)]">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={optimisticState.name}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="jobTitle"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Job title
                </Label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  defaultValue={optimisticState.jobTitle}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Salutation
                </Label>
                <EntityFormField
                  entity="salutation"
                  name="salutation"
                  initialId={null}
                  placeholder="Select salutation…"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="status"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Status
                </Label>
                <Select name="status" defaultValue={optimisticState.status}>
                  <SelectTrigger className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_lead">New lead</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="unqualified">Unqualified</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Organisation</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Where this contact works.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Account
                </Label>
                <EntityFormField
                  entity="account"
                  name="accountId"
                  initialId={optimisticState.accountId}
                  placeholder="Select account…"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="company"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Company (free text)
                </Label>
                <Input
                  id="company"
                  name="company"
                  defaultValue={optimisticState.company}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">
                Contact channels
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Email, phone, and social profiles.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Email <span className="text-[var(--st-danger)]">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={optimisticState.email}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={optimisticState.phone}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="linkedinUrl"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  LinkedIn URL
                </Label>
                <Input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  defaultValue={initial.linkedinUrl}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="twitterHandle"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  X / Twitter handle
                </Label>
                <Input
                  id="twitterHandle"
                  name="twitterHandle"
                  defaultValue={initial.twitterHandle}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Lifecycle</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Stage, source, and ownership.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="lifecycleStage"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Lifecycle stage
                </Label>
                <Select
                  name="lifecycleStage"
                  defaultValue={initial.lifecycleStage || 'lead'}
                >
                  <SelectTrigger className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="mql">MQL</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="evangelist">Evangelist</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="source"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Source
                </Label>
                <Select
                  name="source"
                  defaultValue={initial.source || 'other'}
                >
                  <SelectTrigger className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="cold-outbound">Cold outbound</SelectItem>
                    <SelectItem value="ad">Ad</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="leadScore"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Lead score
                </Label>
                <Input
                  id="leadScore"
                  name="leadScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={initial.leadScore}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Owner
                </Label>
                <EntityFormField
                  entity="user"
                  name="owner"
                  initialId={initial.owner || null}
                  placeholder="Select owner…"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">
                Tags &amp; locale
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Comma-separated tags, birthday, timezone.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="tags"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Tags
                </Label>
                <Input
                  id="tags"
                  name="tags"
                  defaultValue={initial.tags.join(', ')}
                  placeholder="vip, hot, q1-target"
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="dateOfBirth"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Date of birth
                </Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={initial.dateOfBirth}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Timezone
                </Label>
                <EntityFormField
                  entity="timezone"
                  name="timezone"
                  initialId={initial.timezone || null}
                  placeholder="Select timezone…"
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.push(`/dashboard/crm/contacts/${initial._id}`);
              }}
            >
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </div>
      </form>
    </EntityDetailShell>
  );
}
