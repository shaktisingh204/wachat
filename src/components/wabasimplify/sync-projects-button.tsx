
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { handleSyncWabas } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle } from 'lucide-react';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Projects from Meta
        </>
      )}
    </Button>
  );
}

export function SyncProjectsButton() {
  const [state, formAction] = useActionState(handleSyncWabas, initialState);
  const { toast } = useToast();
  
  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Sync Complete',
        description: state.message,
      });
    }
    if (state?.error) {
      toast({
        title: 'Sync Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction}>
      <SubmitButton />
    </form>
  );
}
