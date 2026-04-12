
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
// import { createCatalog } from '@/app/actions/catalog.actions';
const createCatalog: any = (...args: any[]) => ({ error: 'not implemented' });
import { useToast } from '@/hooks/use-toast';

const initialState = {
  success: false,
  message: undefined,
  error: undefined,
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
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Create New Product Catalog</DialogTitle>
            <DialogDescription>
              This will create a new, empty product catalog in your Meta Business account.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="catalogName">Catalog Name</Label>
                <Input id="catalogName" name="catalogName" placeholder="e.g., My Online Store" required maxLength={100} />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
