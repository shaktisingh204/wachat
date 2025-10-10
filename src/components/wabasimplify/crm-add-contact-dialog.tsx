
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

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Contact
    </Button>
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
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
            <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Manually add a new contact or lead to your CRM.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" required /></div>
                    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
                    <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" name="company" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="jobTitle">Job Title</Label><Input id="jobTitle" name="jobTitle" /></div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="accountId">Account (Company)</Label>
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
                        <Label htmlFor="status">Status</Label>
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
                    <Label htmlFor="leadScore">Lead Score</Label>
                    <Input id="leadScore" name="leadScore" type="number" placeholder="e.g. 75" />
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
