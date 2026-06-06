'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import type { WithId,
  CrmContact,
  CrmAccount } from '@/lib/definitions';

import { DatePicker } from '../ui/date-picker';

const initialState = { message: undefined, error: undefined };

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
      <ZoruDialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Deal
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="closeDate" value={closeDate?.toISOString()} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Create New Deal</ZoruDialogTitle>
            <ZoruDialogDescription>Track a new sales opportunity.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2"><Label htmlFor="name">Deal Name</Label><Input id="name" name="name" required placeholder="e.g. Website Redesign for Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="value">Value</Label><Input id="value" name="value" type="number" step="0.01" required placeholder="10000" /></div>
                <div className="space-y-2"><Label htmlFor="currency">Currency</Label><Select name="currency" defaultValue="USD" required><ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="USD">USD</ZoruSelectItem><ZoruSelectItem value="INR">INR</ZoruSelectItem><ZoruSelectItem value="EUR">EUR</ZoruSelectItem></ZoruSelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select name="stage" defaultValue={dealStages[0]} required>
                    <ZoruSelectTrigger id="stage"><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {dealStages.map(stage => (
                        <ZoruSelectItem key={stage} value={stage}>{stage}</ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Expected Close Date</Label><DatePicker date={closeDate} setDate={setCloseDate} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="accountId">Account</Label><Select name="accountId" required><ZoruSelectTrigger id="accountId"><ZoruSelectValue placeholder="Select an account..." /></ZoruSelectTrigger><ZoruSelectContent>{accounts.map(acc => <ZoruSelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</ZoruSelectItem>)}</ZoruSelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="contactId">Primary Contact</Label><Select name="contactId" required><ZoruSelectTrigger id="contactId"><ZoruSelectValue placeholder="Select a contact..." /></ZoruSelectTrigger><ZoruSelectContent>{contacts.map(c => <ZoruSelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</ZoruSelectItem>)}</ZoruSelectContent></Select></div>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
