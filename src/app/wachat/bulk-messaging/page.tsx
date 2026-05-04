'use client';

/**
 * Wachat Bulk Messaging — send messages to multiple numbers at once.
 * ZoruUI rebuild. Same handler (sendBulkMessages); only chrome is new.
 */

import * as React from 'react';
import { useState } from 'react';
import { CircleCheck, CircleX, Loader2, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruLabel,
  ZoruProgress,
  ZoruTextarea,
} from '@/components/zoruui';

import { sendBulkMessages } from '@/app/actions/wachat-features.actions';

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);

  const lines = numbers
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const canSend = lines.length > 0 && message.trim().length > 0 && !!projectId;

  const handleSend = async () => {
    if (!canSend) {
      toast({
        title: 'Missing info',
        description: 'Add phone numbers and a message.',
        variant: 'destructive',
      });
      return;
    }
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'No project selected.',
        variant: 'destructive',
      });
      return;
    }
    setSending(true);
    setResult(null);
    const res = await sendBulkMessages(projectId, lines, message.trim());
    setSending(false);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      setResult({
        success: res.success || 0,
        failed: res.failed || 0,
        total: res.total || lines.length,
      });
      toast({
        title: 'Complete',
        description: `Sent ${res.success} of ${res.total} messages.`,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Bulk Messaging</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Bulk Messaging
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Send a message to multiple phone numbers at once.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ZoruCard className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="bm-numbers">
              Phone numbers (one per line)
            </ZoruLabel>
            <ZoruTextarea
              id="bm-numbers"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              rows={6}
              disabled={sending}
              placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="bm-message">Message</ZoruLabel>
            <ZoruTextarea
              id="bm-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={sending}
              placeholder="Type your message here..."
            />
          </div>
          <div>
            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <ZoruButton disabled={sending || !canSend}>
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {sending ? 'Sending…' : 'Send all'}
                </ZoruButton>
              </ZoruAlertDialogTrigger>
              <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                  <ZoruAlertDialogTitle>
                    Confirm bulk send?
                  </ZoruAlertDialogTitle>
                  <ZoruAlertDialogDescription>
                    {lines.length} message{lines.length === 1 ? '' : 's'} will
                    be sent immediately. Charges may apply per recipient and
                    these messages cannot be unsent.
                  </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                  <ZoruAlertDialogAction onClick={handleSend}>
                    Send {lines.length} message
                    {lines.length === 1 ? '' : 's'}
                  </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
              </ZoruAlertDialogContent>
            </ZoruAlertDialog>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h2 className="text-sm text-zoru-ink mb-4">Result</h2>
          {sending ? (
            <div className="flex h-20 items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              <p className="text-[13px] text-zoru-ink-muted">
                Sending messages…
              </p>
            </div>
          ) : result ? (
            <>
              <ZoruProgress value={100} className="mb-4 h-3" />
              <p className="mb-4 text-[13px] text-zoru-ink">
                {result.total} processed
              </p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-zoru-success" />
                  <span className="text-[13px] text-zoru-ink">
                    {result.success} sent
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CircleX className="h-4 w-4 text-zoru-danger" />
                  <span className="text-[13px] text-zoru-ink">
                    {result.failed} failed
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-zoru-ink-muted">
              Enter numbers and a message, then click Send all.
            </p>
          )}
        </ZoruCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
