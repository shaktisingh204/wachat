

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
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { handleSyncWabas } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        'Sync Projects'
      )}
    </Button>
  );
}

interface SyncProjectsDialogProps {
  onSuccess: () => void;
}

export function SyncProjectsDialog({ onSuccess }: SyncProjectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleSyncWabas, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Error Syncing Projects', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Projects from Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Sync Projects with Meta</DialogTitle>
            <DialogDescription>
              Enter a permanent User Access Token from your Meta Business account to sync your projects.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accessToken">Meta Access Token</Label>
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="A permanent token with business management permissions"
                required
              />
               <p className="text-xs text-muted-foreground">
                Follow the manual setup guide for instructions on generating a token.
              </p>
            </div>
             <div className="space-y-2">
                <Label htmlFor="groupName">Group Name (Optional)</Label>
                <Input id="groupName" name="groupName" placeholder="e.g. My Agency's Clients" />
                <p className="text-xs text-muted-foreground">All synced projects will be added to this new group.</p>
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
