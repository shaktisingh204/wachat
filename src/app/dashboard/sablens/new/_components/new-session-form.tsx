'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { createSablensSession } from '@/app/actions/sablens.actions';
import type { SablensSessionMode } from '@/lib/rust-client/sablens-sessions';

export function NewSessionForm() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mode, setMode] = useState<SablensSessionMode>('live_call');
  const [notes, setNotes] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSablensSession({
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        mode,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        toast({ title: 'Could not create session', description: res.error });
        return;
      }
      toast({
        title: 'Session created',
        description: 'Share the customer link from the session console.',
      });
      router.push(`/dashboard/sablens/${res.data._id}`);
    });
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <ZoruCardHeader>
          <ZoruCardTitle>New SabLens session</ZoruCardTitle>
          <ZoruCardDescription>
            Create a session, then send the customer their unique join link
            (`/lens/&lt;token&gt;`). The link expires when the session ends.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerName">Customer name</Label>
              <Input
                id="customerName"
                placeholder="Mrs. Patel"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerEmail">Customer email</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as SablensSessionMode)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="live_call">
                  Live call — both ends connected in real time
                </ZoruSelectItem>
                <ZoruSelectItem value="async_recorded">
                  Async recorded — customer captures, you review later
                </ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Issue summary, equipment, prep notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </ZoruCardContent>
        <ZoruCardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/dashboard/sablens')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create session'}
          </Button>
        </ZoruCardFooter>
      </form>
    </Card>
  );
}
