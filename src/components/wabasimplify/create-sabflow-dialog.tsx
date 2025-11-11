
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
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveSabFlow } from '@/app/actions/sabflow.actions';
import { useRouter } from 'next/navigation';

const initialState = { message: null, error: null, flowId: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create Flow
    </Button>
  );
}

interface CreateSabFlowDialogProps {
  onSuccess: () => void;
}

export function CreateSabFlowDialog({ onSuccess }: CreateSabFlowDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveSabFlow, initialState);
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message && state.flowId) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      onSuccess();
      setOpen(false);
      router.push(`/dashboard/sabflow/flow-builder/${state.flowId}`);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess, router]);

  const handleFormAction = (formData: FormData) => {
    const startNode = { id: 'start', type: 'trigger', data: { name: 'Start', triggerType: 'manual' }, position: { x: 50, y: 50 } };
    formData.append('flowId', 'new-flow');
    formData.append('nodes', JSON.stringify([startNode]));
    formData.append('edges', '[]');
    formData.append('trigger', JSON.stringify({type: 'manual'}));
    formAction(formData);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Flow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={handleFormAction} ref={formRef}>
            <DialogHeader>
                <DialogTitle>Create New Flow</DialogTitle>
                <DialogDescription>Give your new automation workflow a name to get started.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="name">Flow Name</Label>
                <Input id="name" name="name" placeholder="e.g., New Lead Follow-up" required />
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
