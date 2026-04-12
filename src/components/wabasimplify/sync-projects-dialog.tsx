
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
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { handleSyncWabas } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? (
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
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const action = (formData: FormData) => {
    startTransition(async () => {
        const result = await handleSyncWabas(null, formData);
        setState(result);
    });
  };

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Could not add WABA', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Add WABA from Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Add WhatsApp Business Account</DialogTitle>
            <DialogDescription>
              Paste a single WhatsApp Business Account (WABA) ID, a permanent access token, and your App ID. We&rsquo;ll fetch the WABA from Meta and add it as a project.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
             <div className="space-y-2">
                <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
                <Input
                    id="wabaId"
                    name="wabaId"
                    placeholder="e.g. 102345678901234"
                    inputMode="numeric"
                    required
                />
                <p className="text-xs text-muted-foreground">
                  Find this in Meta Business Manager → WhatsApp Accounts → your WABA. Do not paste the Business Portfolio ID, Page ID, or App ID here.
                </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Meta Access Token</Label>
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="Permanent system-user token"
                required
              />
               <p className="text-xs text-muted-foreground">
                Needs <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code> scopes. See the manual setup guide for instructions on generating a system-user token.
              </p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="appId">App ID</Label>
                <Input
                    id="appId"
                    name="appId"
                    placeholder="Your Meta App ID"
                    required
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="groupName">Group Name (Optional)</Label>
                <Input id="groupName" name="groupName" placeholder="e.g. My Agency's Clients" />
                <p className="text-xs text-muted-foreground">The added project will be placed into this new group.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
                {isPending ? (
                    <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                    </>
                ) : (
                    'Add WABA'
                )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
