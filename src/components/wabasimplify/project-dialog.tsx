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
import { PlusCircle, LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

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
        <Card className="flex flex-col items-center justify-center border-2 border-dashed hover:border-primary hover:shadow-lg transition-all cursor-pointer min-h-[240px]">
            <CardContent className="flex flex-col items-center justify-center p-6">
                <PlusCircle className="h-10 w-10 text-muted-foreground mb-4" />
                <span className="font-semibold text-center">Create New Project</span>
            </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter your WhatsApp Business credentials. We'll retrieve your associated phone numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Project Name</Label>
              <Input id="name" name="name" placeholder="My Awesome Business" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wabaId" className="text-right">Business ID</Label>
              <Input id="wabaId" name="wabaId" placeholder="WhatsApp Business Account ID" className="col-span-3" required />
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
