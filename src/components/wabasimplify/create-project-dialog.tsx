
'use client';

import { useEffect, useState, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { handleManualWachatSetup } from '@/app/actions/whatsapp.actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
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
          Verifying and Saving...
        </>
      ) : (
        'Create Project'
      )}
    </Button>
  );
}

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleManualWachatSetup, initialState);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      setOpen(false); 
      router.push('/dashboard');
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="flex flex-col text-center hover:shadow-lg hover:border-primary transition-all cursor-pointer card-gradient card-gradient-purple">
            <CardHeader>
                <CardTitle>Manual Setup</CardTitle>
                <CardDescription>Enter your credentials directly if you are an advanced user.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center p-6">
                <Key className="h-10 w-10 text-muted-foreground mb-4" />
                <Button variant="outline">Connect Manually</Button>
            </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Manual Project Setup</DialogTitle>
            <DialogDescription>
               Enter your WABA ID, App ID, and a permanent Access Token. For help finding these, please consult the{' '}
              <Link href="/dashboard/setup/docs" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  manual setup guide
              </Link>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wabaId">WABA ID</Label>
              <Input id="wabaId" name="wabaId" placeholder="WhatsApp Business Account ID" required />
            </div>
             <div className="space-y-2">
              <Label htmlFor="appId">App ID</Label>
              <Input id="appId" name="appId" placeholder="Your Meta App ID" defaultValue={process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Permanent Access Token</Label>
              <Input id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User token" required />
            </div>
            <div className="pt-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id="include-catalog-manual" name="includeCatalog" defaultChecked={true} />
                    <Label htmlFor="include-catalog-manual" className="text-sm font-normal">
                        Include permissions for Catalog Management
                    </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-6">This will attempt to find a Business ID associated with your token.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
