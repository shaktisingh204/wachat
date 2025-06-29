
'use client';

import { useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { handleCreateProject } from '@/app/actions';
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
import { PlusCircle, LoaderCircle, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

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
  const [state, formAction] = useActionState(handleCreateProject, initialState);
  const { toast } = useToast();
  
  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      setOpen(false); 
    }
    if (state?.error) {
      toast({
        title: 'Project Creation Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="flex flex-col text-center hover:shadow-lg hover:border-primary transition-all cursor-pointer">
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
              Enter your WhatsApp Business ID, App ID, and a permanent System User Token. The project will be automatically named after your verified business name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wabaId" className="text-right">Business ID</Label>
              <Input id="wabaId" name="wabaId" placeholder="WhatsApp Business Account ID" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="appId" className="text-right">App ID</Label>
              <Input id="appId" name="appId" placeholder="Your Meta App ID" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accessToken" className="text-right">Access Token</Label>
              <Input id="accessToken" name="accessToken" type="password" placeholder="A permanent System User Token" className="col-span-3" required />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
