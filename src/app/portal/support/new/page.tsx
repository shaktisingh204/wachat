'use client';

/**
 * /portal/support/new — customer-facing new-ticket form.
 *
 * Always submits with `channel = 'portal'` (set server-side in
 * `createSupportTicket`), so the staff workspace can filter portal
 * tickets.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { createSupportTicket } from '@/app/actions/helpdesk.actions';

export default function NewSupportTicketPage(): React.JSX.Element {
  const { toast } = useZoruToast();
  const router = useRouter();
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupportTicket({ subject, body, priority });
      if (res.success && res.id) {
        toast({ title: 'Ticket created' });
        router.push(`/portal/support/${res.id}`);
      } else {
        toast({ title: res.error ?? 'Failed', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <ZoruCardContent className="space-y-4 p-6">
          <div>
            <h1 className="text-[18px] font-semibold text-zoru-ink">Open a support request</h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              Tell us what's happening. Our team will follow up via the channel you signed in with.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Can't access my account"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <ZoruSelectTrigger className="mt-1">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="low">Low — when you have time</ZoruSelectItem>
                  <ZoruSelectItem value="medium">Medium — within a day</ZoruSelectItem>
                  <ZoruSelectItem value="high">High — blocks my work</ZoruSelectItem>
                  <ZoruSelectItem value="urgent">Urgent — production impact</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="body">Describe the issue</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="What happened? What did you expect? Steps to reproduce..."
                required
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <Button asChild variant="ghost">
                <Link href="/portal/support">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Submitting...' : 'Submit request'}
              </Button>
            </div>
          </form>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
