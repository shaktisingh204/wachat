
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveVoucherBook } from '@/app/actions/crm-vouchers.actions';

const voucherTypes = [
  'Contra', 'Journal', 'Reversing Journal', 'Payment', 'Receipt',
  'Debit Note', 'Credit Note', 'Sales', 'Purchase', 'Reimbursement'
];

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Submit
    </ZoruButton>
  );
}

export function CreateVoucherBookDialog({ onSave }: { onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveVoucherBook, initialState);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      onSave();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSave]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> New Voucher Book</ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Create New Voucher Book</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="voucherBookName">Voucher Book Name *</ZoruLabel>
                <ZoruInput id="voucherBookName" name="voucherBookName" placeholder="Name of the Voucher Book" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="voucherBookType">Voucher Book Type *</ZoruLabel>
                <ZoruSelect name="voucherBookType" required>
                  <ZoruSelectTrigger id="voucherBookType">
                    <ZoruSelectValue placeholder="ZoruSelect Voucher Book Type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {voucherTypes.map(type => (
                      <ZoruSelectItem key={type} value={type}>{type}</ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
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
