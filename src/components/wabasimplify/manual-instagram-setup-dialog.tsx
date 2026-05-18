
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Wrench, Key } from 'lucide-react';
import { handleManualFacebookPageSetup } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Connect Page
    </ZoruButton>
  );
}

export function ManualInstagramSetupDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleManualFacebookPageSetup, initialState);
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Instagram/Facebook Page connected successfully.' });
      onOpenChange(false);
      router.push('/dashboard/instagram/connections');
      router.refresh();
    }
    if (state.error) {
      toast({ title: 'Connection Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
    }
    setOpen(isOpen);
  }

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogTrigger asChild>
        <Card className="flex flex-col text-center hover:shadow-lg hover:border-primary transition-all cursor-pointer card-gradient card-gradient-orange">
          <CardHeader>
            <CardTitle>Manual Setup</CardTitle>
            <CardDescription>Enter your credentials directly if you are an advanced user.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col items-center justify-center p-6">
            <Key className="h-10 w-10 text-muted-foreground mb-4" />
            <ZoruButton variant="outline">Connect Manually</ZoruButton>
          </CardContent>
        </Card>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Manual Instagram/Facebook Connection</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter your Page ID and a permanent Access Token. For help, see the{' '}
              <Link href="/dashboard/instagram/setup/docs" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                manual setup guide
              </Link>.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="projectName">Connection Name</ZoruLabel>
                <ZoruInput id="projectName" name="projectName" placeholder="e.g., My Instagram Business Account" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="facebookPageId">Facebook Page ID</ZoruLabel>
                <ZoruInput id="facebookPageId" name="facebookPageId" placeholder="Your Page ID (linked to Instagram)" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="adAccountId">Ad Account ID</ZoruLabel>
                <ZoruInput id="adAccountId" name="adAccountId" placeholder="act_xxxxxxxxxxxx" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="accessToken">Permanent Access Token</ZoruLabel>
                <ZoruInput id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User Token" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
