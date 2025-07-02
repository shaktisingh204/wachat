
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
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { createCatalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Create Catalog'}
    </Button>
  );
}

interface CreateCatalogDialogProps {
  projectId: string | null;
  onCatalogCreated: () => void;
}

export function CreateCatalogDialog({ projectId, onCatalogCreated }: CreateCatalogDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCatalog, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onCatalogCreated();
    }
    if (state.error) {
      toast({ title: 'Error Creating Catalog', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onCatalogCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!projectId}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Catalog
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId || ''} />
          <DialogHeader>
            <DialogTitle>Create New Product Catalog</DialogTitle>
            <DialogDescription>
              This will create a new, empty product catalog in your Meta Business account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="catalogName">Catalog Name</Label>
              <Input id="catalogName" name="catalogName" placeholder="e.g., My Online Store" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
