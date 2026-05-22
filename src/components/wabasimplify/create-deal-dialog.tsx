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
} from '@/components/zoruui';
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create Deal
    </ZoruButton>
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
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton>
          <Plus className="mr-2 h-4 w-4" />
          Create Deal
        </ZoruButton>
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
              <div className="space-y-2"><ZoruLabel htmlFor="name">Deal Name</ZoruLabel><ZoruInput id="name" name="name" required placeholder="e.g. Website Redesign for Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><ZoruLabel htmlFor="value">Value</ZoruLabel><ZoruInput id="value" name="value" type="number" step="0.01" required placeholder="10000" /></div>
                <div className="space-y-2"><ZoruLabel htmlFor="currency">Currency</ZoruLabel><ZoruSelect name="currency" defaultValue="USD" required><ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="USD">USD</ZoruSelectItem><ZoruSelectItem value="INR">INR</ZoruSelectItem><ZoruSelectItem value="EUR">EUR</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ZoruLabel htmlFor="stage">Stage</ZoruLabel>
                  <ZoruSelect name="stage" defaultValue={dealStages[0]} required>
                    <ZoruSelectTrigger id="stage"><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {dealStages.map(stage => (
                        <ZoruSelectItem key={stage} value={stage}>{stage}</ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="space-y-2"><ZoruLabel>Expected Close Date</ZoruLabel><DatePicker date={closeDate} setDate={setCloseDate} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><ZoruLabel htmlFor="accountId">Account</ZoruLabel><ZoruSelect name="accountId" required><ZoruSelectTrigger id="accountId"><ZoruSelectValue placeholder="Select an account..." /></ZoruSelectTrigger><ZoruSelectContent>{accounts.map(acc => <ZoruSelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                <div className="space-y-2"><ZoruLabel htmlFor="contactId">Primary Contact</ZoruLabel><ZoruSelect name="contactId" required><ZoruSelectTrigger id="contactId"><ZoruSelectValue placeholder="Select a contact..." /></ZoruSelectTrigger><ZoruSelectContent>{contacts.map(c => <ZoruSelectItem key={c._id.toString()} value={c._id.toString()}>{c.name}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
