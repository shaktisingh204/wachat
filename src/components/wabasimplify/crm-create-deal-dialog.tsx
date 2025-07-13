

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

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create Deal
    </Button>
  );
}

interface CreateDealDialogProps {
    contacts: WithId<CrmContact>[];
    accounts: WithId<CrmAccount>[];
    onDealCreated: () => void;
    dealStages: string[];
}

export function CreateDealDialog({ contacts, accounts, onDealCreated, dealStages }: CreateDealDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCrmDeal, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [closeDate, setCloseDate] = useState<Date | undefined>();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setCloseDate(undefined);
      setOpen(false);
      onDealCreated();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onDealCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="closeDate" value={closeDate?.toISOString()} />
            <DialogHeader>
                <DialogTitle>Create New Deal</DialogTitle>
                <DialogDescription>Track a new sales opportunity.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label htmlFor="name">Deal Name</Label><Input id="name" name="name" required placeholder="e.g. Website Redesign for Acme Corp" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="value">Value</Label><Input id="value" name="value" type="number" step="0.01" required placeholder="10000" /></div>
                    <div className="space-y-2"><Label htmlFor="currency">Currency</Label><Select name="currency" defaultValue="USD" required><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="INR">INR</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="stage">Stage</Label>
                        <Select name="stage" defaultValue={dealStages[0]} required>
                            <SelectTrigger id="stage"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {dealStages.map(stage => (
                                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Expected Close Date</Label><DatePicker date={closeDate} setDate={setCloseDate} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="accountId">Account</Label><Select name="accountId" required><SelectTrigger id="accountId"><SelectValue placeholder="Select an account..."/></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="contactId">Primary Contact</Label><Select name="contactId" required><SelectTrigger id="contactId"><SelectValue placeholder="Select a contact..." /></SelectTrigger><SelectContent>{contacts.map(c => <SelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
