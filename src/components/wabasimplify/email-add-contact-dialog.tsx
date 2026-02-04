
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
import { LoaderCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addEmailContact } from '@/app/actions/email.actions';
import type { WithId, Tag } from '@/lib/definitions';
import { MultiSelectCombobox } from './multi-select-combobox';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Contact
    </Button>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Add New Email Contact</DialogTitle>
            <DialogDescription>Manually add a contact to your email list.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input id="name" name="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (Optional)</Label>
                <MultiSelectCombobox
                  options={availableTags.map(t => ({ value: t._id, label: t.name, color: t.color }))}
                  selected={selectedTagIds}
                  onSelectionChange={setSelectedTagIds}
                  placeholder="Select tags..."
                />
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
