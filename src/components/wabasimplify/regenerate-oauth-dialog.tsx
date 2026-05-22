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
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Link as LinkIcon } from 'lucide-react';
import { handleRegenerateOauthLink } from '@/app/actions/whatsapp-pay.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project, PaymentConfiguration } from '@/lib/definitions';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

const initialState: any = { message: undefined, error: undefined, oauth_url: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Regenerate Link'}
    </Button>
  );
}

interface RegenerateOauthDialogProps {
  project: WithId<Project>;
  config: PaymentConfiguration;
  onSuccess: () => void;
}

export function RegenerateOauthDialog({ project, config, onSuccess }: RegenerateOauthDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<any, FormData>(handleRegenerateOauthLink, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if ((state as any).message && !(state as any).oauth_url) {
      toast({ title: 'Success!', description: (state as any).message });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess, setOpen]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
      // Reset state if dialog is closed without completing the flow
      if (state.oauth_url) {
        window.location.reload(); // Force a refresh to show correct state
      }
    }
    setOpen(isOpen);
  };

  if (state.oauth_url) {
    return (
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Complete Re-onboarding</ZoruDialogTitle>
          <ZoruDialogDescription>
            Your OAuth link has been regenerated. Please complete the setup with your payment provider.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <Alert>
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            Click the button below to go to the provider's site and re-authorize the connection.
          </AlertDescription>
        </Alert>
        <ZoruDialogFooter>
          <Button asChild>
            <a href={state.oauth_url} target="_blank" rel="noopener noreferrer" onClick={() => handleOpenChange(false)}>
              Complete Onboarding
            </a>
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" />
          Regenerate Link
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="configuration_name" value={config.configuration_name} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Regenerate OAuth Link</ZoruDialogTitle>
            <ZoruDialogDescription>
              This will generate a new onboarding link for "{config.configuration_name}".
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="redirect_url">Redirect URL</Label>
              <Input
                id="redirect_url"
                name="redirect_url"
                type="url"
                placeholder="https://your-site.com/payment/callback"
                required
              />
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
