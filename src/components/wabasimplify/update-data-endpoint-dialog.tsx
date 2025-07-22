
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
import { LoaderCircle, Link, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateDataEndpoint } from '@/app/actions/whatsapp.actions';
import type { WithId, Project, PaymentConfiguration } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}
      Update Endpoint
    </Button>
  );
}

interface UpdateDataEndpointDialogProps {
  project: WithId<Project>;
  config: PaymentConfiguration;
  onSuccess: () => void;
}

export function UpdateDataEndpointDialog({ project, config, onSuccess }: UpdateDataEndpointDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleUpdateDataEndpoint, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error Updating Endpoint', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4"/>
            Data Endpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="configurationName" value={config.configuration_name} />
          <DialogHeader>
            <DialogTitle>Update Data Endpoint</DialogTitle>
            <DialogDescription>
              Set the URL for WhatsApp to fetch dynamic data for coupons, shipping, etc for the "{config.configuration_name}" configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dataEndpointUrl">Endpoint URL</Label>
              <Input id="dataEndpointUrl" name="dataEndpointUrl" placeholder="https://your-api.com/whatsapp-data" required />
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

    