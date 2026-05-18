'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Link, Settings } from 'lucide-react';
import { handleUpdateDataEndpoint } from '@/app/actions/whatsapp-pay.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project, PaymentConfiguration } from '@/lib/definitions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}
      Update Endpoint
    </ZoruButton>
  );
}

interface UpdateDataEndpointDialogProps {
  project: WithId<Project>;
  config: PaymentConfiguration;
  onSuccess: () => void;
}

export function UpdateDataEndpointDialog({ project, config, onSuccess }: UpdateDataEndpointDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleUpdateDataEndpoint as any, initialState as any);
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
  }, [state, toast, onSuccess, setOpen]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4"/>
            Data Endpoint
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="configurationName" value={config.configuration_name} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update Data Endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set the URL for WhatsApp to fetch dynamic data for coupons, shipping, etc for the "{config.configuration_name}" configuration.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="dataEndpointUrl">Endpoint URL</ZoruLabel>
              <ZoruInput id="dataEndpointUrl" name="dataEndpointUrl" placeholder="https://your-api.com/whatsapp-data" required />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
