'use client';

/**
 * Wachat Bulk Messaging — send messages to multiple numbers at once.
 */

import * as React from 'react';
import { useState, useRef } from 'react';
import { LuSend, LuLoader, LuCircleCheck, LuCircleX, LuImage } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const abortRef = useRef(false);

  const handleSend = async () => {
    const lines = numbers.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0 || !message.trim()) {
      toast({ title: 'Missing info', description: 'Add phone numbers and a message.', variant: 'destructive' });
      return;
    }
    setSending(true);
    abortRef.current = false;
    setProgress({ sent: 0, failed: 0, total: lines.length });

    for (let i = 0; i < lines.length; i++) {
      if (abortRef.current) break;
      // Simulate sending with a short delay
      await new Promise((r) => setTimeout(r, 300));
      const success = Math.random() > 0.1;
      setProgress((p) => ({
        ...p,
        sent: p.sent + (success ? 1 : 0),
        failed: p.failed + (success ? 0 : 1),
      }));
    }
    setSending(false);
    toast({ title: 'Complete', description: 'Bulk send finished.' });
  };

  const handleStop = () => { abortRef.current = true; };

  const processed = progress.sent + progress.failed;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Bulk Messaging' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Bulk Messaging</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Send a message to multiple phone numbers at once.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ClayCard padded={false} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-clay-ink mb-1.5 block">Phone Numbers (one per line)</label>
            <textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={6} disabled={sending}
              placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none resize-none font-mono" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-clay-ink mb-1.5 block">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} disabled={sending}
              placeholder="Type your message here..."
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none resize-none" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-clay-ink mb-1.5 flex items-center gap-1.5">
              <LuImage className="h-3.5 w-3.5" /> Media URL (optional)
            </label>
            <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} disabled={sending}
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <ClayButton variant="obsidian" size="md" onClick={handleSend} disabled={sending}
              leading={sending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <LuSend className="h-3.5 w-3.5" />}>
              {sending ? 'Sending...' : 'Send All'}
            </ClayButton>
            {sending && (
              <ClayButton variant="pill" size="md" onClick={handleStop}>Stop</ClayButton>
            )}
          </div>
        </ClayCard>

        <ClayCard padded={false} className="p-6">
          <h2 className="text-[16px] font-semibold text-clay-ink mb-4">Progress</h2>
          {progress.total > 0 ? (
            <>
              <div className="h-3 w-full overflow-hidden rounded-full bg-clay-surface-2 mb-4">
                <div className="h-full rounded-full bg-clay-rose transition-all"
                  style={{ width: `${(processed / progress.total) * 100}%` }} />
              </div>
              <p className="text-[13px] text-clay-ink mb-4">{processed} / {progress.total} processed</p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <LuCircleCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-[13px] text-clay-ink">{progress.sent} sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <LuCircleX className="h-4 w-4 text-red-500" />
                  <span className="text-[13px] text-clay-ink">{progress.failed} failed</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-clay-ink-muted py-8 text-center">Enter numbers and a message, then click Send All.</p>
          )}
        </ClayCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
