
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmContact } from '@/app/actions/crm.actions';
import type { CrmAccount, WithId } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ClayButton } from '@/components/clay';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
    >
      Add Contact
    </ClayButton>
  );
}

interface CrmAddContactDialogProps {
  onAdded: () => void;
  accounts: WithId<CrmAccount>[];
}

export function CrmAddContactDialog({ onAdded, accounts }: CrmAddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addCrmContact, initialState);
  const { toast } = useToast();
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
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-clay-ink">Add New Contact</DialogTitle>
            <DialogDescription className="text-clay-ink-muted">Manually add a new contact or lead to your CRM.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="name" className="text-clay-ink">Full Name</Label><Input id="name" name="name" required /></div>
                <div className="space-y-2"><Label htmlFor="email" className="text-clay-ink">Email</Label><Input id="email" name="email" type="email" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="phone" className="text-clay-ink">Phone</Label><Input id="phone" name="phone" /></div>
                <div className="space-y-2"><Label htmlFor="company" className="text-clay-ink">Company</Label><Input id="company" name="company" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="jobTitle" className="text-clay-ink">Job Title</Label><Input id="jobTitle" name="jobTitle" /></div>
              <Separator className="border-clay-border" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId" className="text-clay-ink">Account (Company)</Label>
                  <Select name="accountId">
                    <SelectTrigger id="accountId">
                      <SelectValue placeholder="Select an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account._id.toString()} value={account._id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-clay-ink">Status</Label>
                  <Select name="status" defaultValue="new_lead">
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_lead">New Lead</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="unqualified">Unqualified</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="imported">Imported</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadScore" className="text-clay-ink">Lead Score</Label>
                <Input id="leadScore" name="leadScore" type="number" placeholder="e.g. 75" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
              </div>
              <Separator className="border-clay-border" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lifecycleStage" className="text-clay-ink">Lifecycle Stage</Label>
                  <Select name="lifecycleStage" defaultValue="lead">
                    <SelectTrigger id="lifecycleStage" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
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
                  <Label htmlFor="source" className="text-clay-ink">Source</Label>
                  <Select name="source" defaultValue="other">
                    <SelectTrigger id="source" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="cold-outbound">Cold Outbound</SelectItem>
                      <SelectItem value="ad">Ad</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner" className="text-clay-ink">Owner</Label>
                  <Input id="owner" name="owner" placeholder="Assigned to..." className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-clay-ink">Tags</Label>
                  <Input id="tags" name="tags" placeholder="vip, enterprise, priority" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl" className="text-clay-ink">LinkedIn URL</Label>
                  <Input id="linkedinUrl" name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/..." className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterHandle" className="text-clay-ink">Twitter / X Handle</Label>
                  <Input id="twitterHandle" name="twitterHandle" placeholder="@handle" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="text-clay-ink">Date of Birth</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-clay-ink">Timezone</Label>
                  <Input id="timezone" name="timezone" placeholder="Asia/Kolkata" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <ClayButton type="button" variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
