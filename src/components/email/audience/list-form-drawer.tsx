'use client';

import { useState, useTransition } from 'react';
import {
  ZoruButton,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerFooter,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  zoruToast,
} from '@/components/zoruui';
import {
  actionCreateEmailList,
  actionUpdateEmailList,
  type EmailListDoc,
} from '@/app/actions/email/audience.actions';

interface EmailListFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: EmailListDoc | null;
  onSaved: () => void;
}

export function EmailListFormDrawer({
  open,
  onOpenChange,
  list,
  onSaved,
}: EmailListFormDrawerProps) {
  const isEdit = Boolean(list?._id);
  const [name, setName] = useState(list?.name ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [fromName, setFromName] = useState(list?.defaultFromName ?? '');
  const [fromEmail, setFromEmail] = useState(list?.defaultFromEmail ?? '');
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      zoruToast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultFromName: fromName.trim() || undefined,
        defaultFromEmail: fromEmail.trim() || undefined,
      };
      const result = isEdit && list
        ? await actionUpdateEmailList(list._id, payload)
        : await actionCreateEmailList(payload);

      if (!result.ok) {
        zoruToast({ title: 'Save failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: isEdit ? 'List updated' : 'List created' });
      onSaved();
      onOpenChange(false);
    });
  };

  return (
    <ZoruDrawer open={open} onOpenChange={onOpenChange}>
      <ZoruDrawerContent>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <ZoruDrawerHeader>
            <ZoruDrawerTitle>{isEdit ? 'Edit list' : 'New list'}</ZoruDrawerTitle>
            <ZoruDrawerDescription>
              Lists hold subscribers and act as the default audience for campaigns.
            </ZoruDrawerDescription>
          </ZoruDrawerHeader>

          <div className="flex-1 overflow-y-auto px-6 space-y-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="list-name">Name</ZoruLabel>
              <ZoruInput
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Newsletter subscribers"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="list-desc">Description</ZoruLabel>
              <ZoruTextarea
                id="list-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about the audience"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <ZoruLabel htmlFor="list-from-name">Default from name</ZoruLabel>
                <ZoruInput
                  id="list-from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Acme Team"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="list-from-email">Default from email</ZoruLabel>
                <ZoruInput
                  id="list-from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@acme.com"
                />
              </div>
            </div>
          </div>

          <ZoruDrawerFooter className="flex flex-row gap-2 justify-end border-t">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create list'}
            </ZoruButton>
          </ZoruDrawerFooter>
        </form>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}
