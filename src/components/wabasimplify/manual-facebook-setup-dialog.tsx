
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
import { LoaderCircle, Wrench } from 'lucide-react';
import { handleManualFacebookPageSetup } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Connect Page
    </Button>
  );
}

interface ManualFacebookSetupDialogProps {
  onSuccess: () => void;
}

export function ManualFacebookSetupDialog({ onSuccess }: ManualFacebookSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleManualFacebookPageSetup, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Facebook Page connected successfully.' });
      onOpenChange(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Connection Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wrench className="mr-2 h-4 w-4" />
          Manual Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Manual Facebook Connection</DialogTitle>
            <DialogDescription>
              Enter the required IDs and tokens from your Meta Developer account. This is for advanced users.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input id="projectName" name="projectName" placeholder="e.g., My Facebook Page" required />
                <p className="text-xs text-muted-foreground">A name for you to identify this connection.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebookPageId">Facebook Page ID</Label>
                <Input id="facebookPageId" name="facebookPageId" placeholder="Your Facebook Page ID" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adAccountId">Ad Account ID</Label>
                <Input id="adAccountId" name="adAccountId" placeholder="act_xxxxxxxxxxxx" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken">Permanent Access Token</Label>
                <Input id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User Token" required />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
