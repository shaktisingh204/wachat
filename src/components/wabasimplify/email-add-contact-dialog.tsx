
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
import { LoaderCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addEmailContact } from '@/app/actions/email.actions';
import type { WithId, Tag } from '@/lib/definitions';
import { MultiSelectCombobox } from './multi-select-combobox';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Contact
    </ZoruButton>
  );
}

interface EmailAddContactDialogProps {
  onAdded: () => void;
  availableTags: WithId<Tag>[];
}

export function EmailAddContactDialog({ onAdded, availableTags }: EmailAddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addEmailContact, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setSelectedTagIds([]);
      setOpen(false);
      onAdded();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onAdded]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Add New Email Contact</ZoruDialogTitle>
            <ZoruDialogDescription>Manually add a contact to your email list.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="email">Email</ZoruLabel>
                <ZoruInput id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="name">Name (Optional)</ZoruLabel>
                <ZoruInput id="name" name="name" />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="tags">Tags (Optional)</ZoruLabel>
                <MultiSelectCombobox
                  options={availableTags.map(t => ({ value: t._id, label: t.name, color: t.color }))}
                  selected={selectedTagIds}
                  onSelectionChange={setSelectedTagIds}
                  placeholder="ZoruSelect tags..."
                />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
