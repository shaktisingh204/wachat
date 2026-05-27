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

import { LoaderCircle, FileUp, AlertCircle } from 'lucide-react';
import { handleCreatePaymentConfiguration } from '@/app/actions/whatsapp-pay.actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { ScrollArea } from '../ui/scroll-area';

type State = {
  message?: string | null;
  error?: string;
  oauth_url?: string | null;
};

const initialState: State = { message: null, error: undefined, oauth_url: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Create Configuration'}
    </Button>
  );
}

interface CreatePaymentConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreatePaymentConfigDialog({ isOpen, onOpenChange, onSuccess }: CreatePaymentConfigDialogProps) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [state, formAction] = useActionState(handleCreatePaymentConfiguration as any, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [providerType, setProviderType] = useState('gateway');

  useEffect(() => {
    if (state.message && !state.oauth_url) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      onOpenChange(false);
    }
    // Removed the error toast to prevent loop and because we show it inline now.
  }, [state, toast, onSuccess, onOpenChange]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      formRef.current?.reset();
      setProviderType('gateway');
    }
    onOpenChange(open);
  }

  if (state.oauth_url) {
    return (
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Complete Onboarding</ZoruDialogTitle>
          <ZoruDialogDescription>
            Your payment configuration has been created. Please complete the setup with your payment provider.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <Alert>
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            Click the button below to go to the provider's site and authorize the connection.
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') || '' : ''} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Create Payment Configuration</ZoruDialogTitle>
            <ZoruDialogDescription>
              This information should match the details in your Meta Commerce Manager account.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {state.error && (
            <Alert variant="destructive" className="mx-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <ScrollArea className="max-h-[60vh] -mx-6 my-4 px-6">
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="configuration_name">Configuration Name</Label>
                <Input id="configuration_name" name="configuration_name" placeholder="e.g., my-razorpay-setup" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider_name">Provider</Label>
                <Select name="provider_name" onValueChange={setProviderType} defaultValue="gateway" required>
                  <ZoruSelectTrigger><ZoruSelectValue placeholder="Select provider type..." /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="razorpay">Razorpay</ZoruSelectItem>
                    <ZoruSelectItem value="payu">PayU</ZoruSelectItem>
                    <ZoruSelectItem value="zaakpay">Zaakpay</ZoruSelectItem>
                    <ZoruSelectItem value="upi_vpa">UPI VPA</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              {providerType !== 'upi_vpa' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="redirect_url">Redirect URL</Label>
                    <Input id="redirect_url" name="redirect_url" type="url" placeholder="https://your-site.com/payment/callback" required />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="merchant_vpa">Merchant VPA</Label>
                    <Input id="merchant_vpa" name="merchant_vpa" placeholder="your-business@okhdfcbank" required />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="purpose_code">Purpose Code</Label>
                <Input id="purpose_code" name="purpose_code" placeholder="e.g., 00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant_category_code">Merchant Category Code (MCC)</Label>
                <Input id="merchant_category_code" name="merchant_category_code" placeholder="e.g., 0000" required />
              </div>
            </div>
          </ScrollArea>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
