
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
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Connect Page
    </Button>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Card className="flex flex-col text-center hover:shadow-lg hover:border-primary transition-all cursor-pointer card-gradient card-gradient-orange">
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
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Manual Instagram/Facebook Connection</DialogTitle>
            <DialogDescription>
              Enter your Page ID and a permanent Access Token. For help, see the{' '}
              <Link href="/dashboard/instagram/setup/docs" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  manual setup guide
              </Link>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Connection Name</Label>
              <Input id="projectName" name="projectName" placeholder="e.g., My Instagram Business Account" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebookPageId">Facebook Page ID</Label>
              <Input id="facebookPageId" name="facebookPageId" placeholder="Your Page ID (linked to Instagram)" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adAccountId">Ad Account ID</Label>
              <Input id="adAccountId" name="adAccountId" placeholder="act_xxxxxxxxxxxx" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Permanent Access Token</Label>
              <Input id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User Token" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
