
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { addSmsContact } from '@/app/actions/sms.actions';

const initialState = { message: null, error: null };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Contact
    </Button>
  );
}

interface SmsAddContactDialogProps {
    onAdded: () => void;
}

export function SmsAddContactDialog({ onAdded }: SmsAddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const action = (formData: FormData) => {
    startTransition(async () => {
        const result = await addSmsContact(null, formData);
        setState(result);
    });
  };

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
      <DialogContent className="sm:max-w-md">
        <form action={action} ref={formRef}>
            <DialogHeader>
                <DialogTitle>Add New SMS Contact</DialogTitle>
                <DialogDescription>Manually add a contact to your SMS list.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="e.g. 919876543210" required />
                    <p className="text-xs text-muted-foreground">Include country code, without the '+' symbol.</p>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Contact
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

