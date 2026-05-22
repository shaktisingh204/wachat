'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  UserPlus } from 'lucide-react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { addCrmContact } from '@/app/actions/crm.actions';
import type { CrmAccount, WithId } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Add Contact
    </ZoruButton>
  );
}

interface CrmAddContactDialogProps {
  onAdded: () => void;
  accounts: WithId<CrmAccount>[];
}

export function CrmAddContactDialog({ onAdded }: CrmAddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addCrmContact, initialState);
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onAdded();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onAdded]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton>
          <UserPlus className="h-4 w-4" />
          Add Contact
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-3 border-b border-zoru-line">
            <ZoruDialogTitle>Add New Contact</ZoruDialogTitle>
            <ZoruDialogDescription>
              Manually add a new contact or lead to your CRM.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="name">Full Name</ZoruLabel>
                  <ZoruInput id="name" name="name" required />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="email">Email</ZoruLabel>
                  <ZoruInput id="email" name="email" type="email" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                  <ZoruInput
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9+()\\-\\s]*"
                    onChange={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+()\-\s]/g, '');
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="company">Company</ZoruLabel>
                  <ZoruInput id="company" name="company" />
                </div>
              </div>

              <div className="space-y-1.5">
                <ZoruLabel htmlFor="jobTitle">Job Title</ZoruLabel>
                <EntityFormField entity="jobTitle" name="jobTitle" />
              </div>

              <ZoruSeparator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="accountId">Account (Company)</ZoruLabel>
                  <EntityFormField
                    entity="client"
                    name="accountId"
                    placeholder="Select an account…"
                    allowCreate
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="status">Status</ZoruLabel>
                  <ZoruSelect name="status" defaultValue="new_lead">
                    <ZoruSelectTrigger id="status">
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="new_lead">New Lead</ZoruSelectItem>
                      <ZoruSelectItem value="contacted">Contacted</ZoruSelectItem>
                      <ZoruSelectItem value="qualified">Qualified</ZoruSelectItem>
                      <ZoruSelectItem value="unqualified">Unqualified</ZoruSelectItem>
                      <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                      <ZoruSelectItem value="imported">Imported</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>

              <div className="space-y-1.5">
                <ZoruLabel htmlFor="leadScore">Lead Score</ZoruLabel>
                <ZoruInput id="leadScore" name="leadScore" type="number" placeholder="e.g. 75" />
              </div>

              <ZoruSeparator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="lifecycleStage">Lifecycle Stage</ZoruLabel>
                  <ZoruSelect name="lifecycleStage" defaultValue="lead">
                    <ZoruSelectTrigger id="lifecycleStage">
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
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="source">Source</ZoruLabel>
                  <EntityFormField entity="leadSource" name="source" initialId="Other" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
                  <EntityFormField entity="user" name="owner" placeholder="Assigned to…" />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                  <ZoruInput id="tags" name="tags" placeholder="vip, enterprise, priority" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="linkedinUrl">LinkedIn URL</ZoruLabel>
                  <ZoruInput
                    id="linkedinUrl"
                    name="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="twitterHandle">Twitter / X Handle</ZoruLabel>
                  <ZoruInput id="twitterHandle" name="twitterHandle" placeholder="@handle" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="dateOfBirth">Date of Birth</ZoruLabel>
                  <ZoruInput id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="timezone">Timezone</ZoruLabel>
                  <EntityFormField entity="timezone" name="timezone" placeholder="Asia/Kolkata" />
                </div>
              </div>
            </div>
          </div>

          <ZoruDialogFooter className="shrink-0 border-t border-zoru-line bg-zoru-bg px-6 pb-5 pt-4 gap-2">
            <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
