
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Settings } from 'lucide-react';
import { updateEcommShopSettings as saveEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project } from '@/lib/definitions';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '../ui/select';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Continue
        </ZoruButton>
    )
}

interface EcommQuickSetupDialogProps {
  project: WithId<Project>;
  onSuccess: () => void;
  children: React.ReactNode;
}

export function EcommQuickSetupDialog({ project, onSuccess, children }: EcommQuickSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveEcommShopSettings as any, initialState as any);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        {children}
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Configure Your Shop</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set a name and currency for your shop to get started. You can add more details later in settings.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="shopName">Shop Name</ZoruLabel>
              <ZoruInput id="shopName" name="shopName" placeholder="My Awesome Store" required />
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
              <ZoruSelect name="currency" defaultValue="USD" required>
                  <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                      <ZoruSelectItem value="USD">USD - US Dollar</ZoruSelectItem>
                      <ZoruSelectItem value="EUR">EUR - Euro</ZoruSelectItem>
                      <ZoruSelectItem value="INR">INR - Indian Rupee</ZoruSelectItem>
                      <ZoruSelectItem value="GBP">GBP - British Pound</ZoruSelectItem>
                  </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
