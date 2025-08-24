
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
import { createProductSet } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { message: null, error: null };

function CollectionSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Create Collection'}
    </Button>
  );
}

interface CreateCollectionDialogProps {
  catalogId: string,
  projectId: string,
  onCollectionCreated: () => void,
}

export function CreateCollectionDialog({ catalogId, projectId, onCollectionCreated }: CreateCollectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createProductSet, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onCollectionCreated();
    }
    if (state.error) {
      toast({ title: 'Error Creating Collection', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onCollectionCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="catalogId" value={catalogId} />
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Create a new product set within this catalog. You can add products later in Commerce Manager.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Collection Name</Label>
              <Input id="name" name="name" placeholder="e.g., Summer Collection" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <CollectionSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
