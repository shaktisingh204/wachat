
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Submit
    </Button>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> New Voucher Book</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Create New Voucher Book</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="voucherBookName">Voucher Book Name *</Label>
                <Input id="voucherBookName" name="voucherBookName" placeholder="Name of the Voucher Book" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucherBookType">Voucher Book Type *</Label>
                <Select name="voucherBookType" required>
                  <SelectTrigger id="voucherBookType">
                    <SelectValue placeholder="Select Voucher Book Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {voucherTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
