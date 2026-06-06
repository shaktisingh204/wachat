'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Settings } from 'lucide-react';
import { updateEcommShopSettings as saveEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId,
  Project } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Continue
        </Button>
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
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Label htmlFor="shopName">Shop Name</Label>
              <Input id="shopName" name="shopName" placeholder="My Awesome Store" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency" defaultValue="USD" required>
                  <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                      <ZoruSelectItem value="USD">USD - US Dollar</ZoruSelectItem>
                      <ZoruSelectItem value="EUR">EUR - Euro</ZoruSelectItem>
                      <ZoruSelectItem value="INR">INR - Indian Rupee</ZoruSelectItem>
                      <ZoruSelectItem value="GBP">GBP - British Pound</ZoruSelectItem>
                  </ZoruSelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
