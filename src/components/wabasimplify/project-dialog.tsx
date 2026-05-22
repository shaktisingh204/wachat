'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useActionState,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { handleManualWachatSetup } from '@/app/actions/whatsapp.actions';

import { LoaderCircle, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Verifying and Saving...
        </>
      ) : (
        'Create Project'
      )}
    </ZoruButton>
  );
}

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleManualWachatSetup as any, initialState as any);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      setOpen(false); 
      router.push('/wachat');
      router.refresh();
    }
    if (state?.error) {
      toast({
        title: 'Project Creation Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Card className="flex flex-col text-center hover:shadow-lg hover:border-primary transition-all cursor-pointer card-gradient card-gradient-purple">
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
      <ZoruDialogContent className="sm:max-w-[525px]">
        <form action={formAction}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Manual Project Setup</ZoruDialogTitle>
            <ZoruDialogDescription>
               Enter your WABA ID, App ID, and a permanent Access Token. For help finding these, please consult the{' '}
              <Link href="/dashboard/wachat/setup/docs" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  manual setup guide
              </Link>.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="wabaId">WABA ID</ZoruLabel>
              <ZoruInput id="wabaId" name="wabaId" placeholder="WhatsApp Business Account ID" required />
            </div>
             <div className="space-y-2">
              <ZoruLabel htmlFor="appId">App ID</ZoruLabel>
              <ZoruInput id="appId" name="appId" placeholder="Your Meta App ID" defaultValue={process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID} required />
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="accessToken">Permanent Access Token</ZoruLabel>
              <ZoruInput id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User token" required />
            </div>
            <div className="pt-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id="include-catalog-manual" name="includeCatalog" defaultChecked={true} />
                    <ZoruLabel htmlFor="include-catalog-manual" className="text-sm font-normal">
                        Include permissions for Catalog Management
                    </ZoruLabel>
                </div>
                <p className="text-xs text-muted-foreground pl-6">This will attempt to find a Business ID associated with your token.</p>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
