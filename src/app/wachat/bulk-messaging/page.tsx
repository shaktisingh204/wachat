'use client';

/**
 * Wachat Bulk Messaging -- send messages to multiple numbers at once.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuSend, LuLoader, LuCircleCheck, LuCircleX } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { sendBulkMessages } from '@/app/actions/wachat-features.actions';

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; total: number } | null>(null);

  const handleSend = async () => {
    const lines = numbers.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0 || !message.trim()) {
      toast({ title: 'Missing info', description: 'Add phone numbers and a message.', variant: 'destructive' });
      return;
    }
    if (!projectId) {
      toast({ title: 'Error', description: 'No project selected.', variant: 'destructive' });
      return;
    }
    setSending(true);
    setResult(null);
    const res = await sendBulkMessages(projectId, lines, message.trim());
    setSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setResult({ success: res.success || 0, failed: res.failed || 0, total: res.total || lines.length });
      toast({ title: 'Complete', description: `Sent ${res.success} of ${res.total} messages.` });
    }
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Bulk Messaging' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Bulk Messaging</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Send a message to multiple phone numbers at once.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ClayCard padded={false} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">Phone Numbers (one per line)</label>
            <textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={6} disabled={sending}
              placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none font-mono" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} disabled={sending}
              placeholder="Type your message here..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none" />
          </div>
          <div>
            <ClayButton variant="obsidian" size="md" onClick={handleSend} disabled={sending || !projectId}
              leading={sending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <LuSend className="h-3.5 w-3.5" />}>
              {sending ? 'Sending...' : 'Send All'}
            </ClayButton>
          </div>
        </ClayCard>

        <ClayCard padded={false} className="p-6">
          <h2 className="text-[16px] font-semibold text-foreground mb-4">Result</h2>
          {sending ? (
            <div className="flex h-20 items-center justify-center gap-3">
              <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">Sending messages...</p>
            </div>
          ) : result ? (
            <>
              <div className="h-3 w-full overflow-hidden rounded-full bg-secondary mb-4">
                <div className="h-full rounded-full bg-primary" style={{ width: '100%' }} />
              </div>
              <p className="text-[13px] text-foreground mb-4">{result.total} processed</p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <LuCircleCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-[13px] text-foreground">{result.success} sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <LuCircleX className="h-4 w-4 text-red-500" />
                  <span className="text-[13px] text-foreground">{result.failed} failed</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground py-8 text-center">Enter numbers and a message, then click Send All.</p>
          )}
        </ClayCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
