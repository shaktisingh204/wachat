
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
import { LoaderCircle, FileUp } from 'lucide-react';
import { handleCreatePaymentConfiguration } from '@/app/actions/whatsapp.actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { message: null, error: undefined, oauth_url: undefined };

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
  const [state, formAction] = useActionState(handleCreatePaymentConfiguration, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [providerType, setProviderType] = useState('gateway');

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      if (!state.oauth_url) {
        onSuccess();
        onOpenChange(false);
      }
    }
    if (state.error) {
      toast({ title: 'Error Creating Configuration', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess, onOpenChange]);

  const handleOpenChange = (open: boolean) => {
      if(!open) {
          formRef.current?.reset();
          setProviderType('gateway');
          // Reset the action state if needed.
      }
      onOpenChange(open);
  }

  if (state.oauth_url) {
      return (
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Complete Onboarding</DialogTitle>
                  <DialogDescription>
                      Your payment configuration has been created. Please complete the setup with your payment provider.
                  </DialogDescription>
              </DialogHeader>
              <Alert>
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                      Click the button below to go to the provider's site and authorize the connection.
                  </AlertDescription>
              </Alert>
              <DialogFooter>
                   <Button asChild>
                        <a href={state.oauth_url} target="_blank" rel="noopener noreferrer" onClick={() => handleOpenChange(false)}>
                            Complete Onboarding
                        </a>
                    </Button>
              </DialogFooter>
          </DialogContent>
      )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="projectId" value={localStorage.getItem('activeProjectId') || ''} />
          <DialogHeader>
            <DialogTitle>Create Payment Configuration</DialogTitle>
            <DialogDescription>
              This information should match the details in your Meta Commerce Manager account.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 my-4 px-6">
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="configuration_name">Configuration Name</Label>
                <Input id="configuration_name" name="configuration_name" placeholder="e.g., my-razorpay-setup" required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="provider_type">Provider Type</Label>
                <Select onValueChange={setProviderType} defaultValue="gateway">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="gateway">Payment Gateway</SelectItem>
                      <SelectItem value="upi_vpa">UPI VPA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {providerType === 'gateway' ? (
                  <>
                      <div className="space-y-2">
                        <Label htmlFor="provider_name">Provider Name</Label>
                        <Input id="provider_name" name="provider_name" placeholder="razorpay" required />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="redirect_url">Redirect URL</Label>
                          <Input id="redirect_url" name="redirect_url" type="url" placeholder="https://your-site.com/payment/callback" required />
                      </div>
                  </>
              ) : (
                  <>
                       <input type="hidden" name="provider_name" value="upi_vpa" />
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
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
