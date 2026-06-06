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
} from '@/components/sabcrm/20ui/compat';
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
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Add Contact
    </Button>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Add Contact
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-3 border-b border-[var(--st-border)]">
            <ZoruDialogTitle>Add New Contact</ZoruDialogTitle>
            <ZoruDialogDescription>
              Manually add a new contact or lead to your CRM.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
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
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Job Title</Label>
                <EntityFormField entity="jobTitle" name="jobTitle" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="accountId">Account (Company)</Label>
                  <EntityFormField
                    entity="client"
                    name="accountId"
                    placeholder="Select an account…"
                    allowCreate
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="new_lead">
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
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leadScore">Lead Score</Label>
                <Input id="leadScore" name="leadScore" type="number" placeholder="e.g. 75" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lifecycleStage">Lifecycle Stage</Label>
                  <Select name="lifecycleStage" defaultValue="lead">
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
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source">Source</Label>
                  <EntityFormField entity="leadSource" name="source" initialId="Other" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="owner">Owner</Label>
                  <EntityFormField entity="user" name="owner" placeholder="Assigned to…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tags">Tags</Label>
                  <Input id="tags" name="tags" placeholder="vip, enterprise, priority" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input
                    id="linkedinUrl"
                    name="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twitterHandle">Twitter / X Handle</Label>
                  <Input id="twitterHandle" name="twitterHandle" placeholder="@handle" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timezone">Timezone</Label>
                  <EntityFormField entity="timezone" name="timezone" placeholder="Asia/Kolkata" />
                </div>
              </div>
            </div>
          </div>

          <ZoruDialogFooter className="shrink-0 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-6 pb-5 pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
