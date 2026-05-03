

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
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import type { WithId, CrmContact, CrmAccount } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
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
      Create Deal
    </ClayButton>
  );
}

interface CreateDealDialogProps {
  contacts: WithId<CrmContact>[];
  accounts: WithId<CrmAccount>[];
  onDealCreated: () => void;
  dealStages: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  defaultContactId?: string;
  defaultAccountId?: string;
}

export function CreateDealDialog({
  contacts,
  accounts,
  onDealCreated,
  dealStages,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  defaultContactId,
  defaultAccountId,
}: CreateDealDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [state, formAction] = useActionState(createCrmDeal, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [closeDate, setCloseDate] = useState<Date | undefined>();
  const lastHandledRef = useRef<typeof state | null>(null);

  useEffect(() => {
    if (lastHandledRef.current === state) return;
    if (state.message) {
      lastHandledRef.current = state;
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setCloseDate(undefined);
      setOpen(false);
      onDealCreated();
    } else if (state.error) {
      lastHandledRef.current = state;
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onDealCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Deal
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="closeDate" value={closeDate?.toISOString()} />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-foreground">Create New Deal</DialogTitle>
            <DialogDescription className="text-muted-foreground">Track a new sales opportunity.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2"><Label htmlFor="name" className="text-foreground">Deal Name</Label><Input id="name" name="name" required placeholder="e.g. Website Redesign for Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="value" className="text-foreground">Value</Label><Input id="value" name="value" type="number" step="0.01" required placeholder="10000" /></div>
                <div className="space-y-2"><Label htmlFor="currency" className="text-foreground">Currency</Label><Select name="currency" defaultValue="USD" required><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="INR">INR</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage" className="text-foreground">Stage</Label>
                  <Select name="stage" defaultValue={dealStages[0]} required>
                    <SelectTrigger id="stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dealStages.map(stage => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label className="text-foreground">Expected Close Date</Label><DatePicker date={closeDate} setDate={setCloseDate} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="accountId" className="text-foreground">Account</Label><Select name="accountId" required defaultValue={defaultAccountId}><SelectTrigger id="accountId"><SelectValue placeholder="Select an account..." /></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="contactId" className="text-foreground">Primary Contact</Label><Select name="contactId" required defaultValue={defaultContactId}><SelectTrigger id="contactId"><SelectValue placeholder="Select a contact..." /></SelectTrigger><SelectContent>{contacts.map(c => <SelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="probability" className="text-foreground">Probability %</Label>
                  <Input id="probability" name="probability" type="number" min={0} max={100} placeholder="e.g. 60" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-foreground">Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger id="priority" className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadSource" className="text-foreground">Lead Source</Label>
                  <Select name="leadSource" defaultValue="other">
                    <SelectTrigger id="leadSource" className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign" className="text-foreground">Campaign</Label>
                  <Input id="campaign" name="campaign" placeholder="e.g. Q1 Launch" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextStep" className="text-foreground">Next Step</Label>
                  <Input id="nextStep" name="nextStep" placeholder="e.g. Send proposal" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lossReason" className="text-foreground">Loss Reason (if lost)</Label>
                  <Input id="lossReason" name="lossReason" placeholder="Optional" className="h-10 rounded-lg border-border bg-card text-[13px]" />
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
