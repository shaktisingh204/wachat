'use client';

import { useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { CircleCheck, CircleX, Loader2, Send, MessageCircle } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { sendBulkMessages } from '@/app/actions/wachat-features.actions';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Label,
  Textarea,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat Bulk Messaging - send messages to multiple numbers at once.
 * Same server action (sendBulkMessages); wachat-ui chrome.
 */

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; total: number } | null>(null);

  const lines = numbers.split('\n').map((l) => l.trim()).filter(Boolean);
  const canSend = lines.length > 0 && message.trim().length > 0 && !!projectId;

  const handleSend = async () => {
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
      setResult({
        success: res.success || 0,
        failed: res.failed || 0,
        total: res.total || lines.length,
      });
      toast({ title: 'Complete', description: `Sent ${res.success} of ${res.total} messages.` });
    }
  };

  return (
    <WaPage>
      <PageHeader
        title="Bulk messaging"
        description="Send a free-text message to a list of phone numbers in one shot."
        kicker="Wachat / bulk messaging"
        eyebrowIcon={MessageCircle}
        backHref="/wachat"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Section title="Compose">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bm-numbers">Phone numbers (one per line)</Label>
              <Textarea
                id="bm-numbers"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                rows={6}
                disabled={sending}
                placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
                className="font-mono"
              />
              <p className="text-[11.5px] tabular-nums text-zinc-500">
                {lines.length} recipient{lines.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bm-message">Message</Label>
              <Textarea
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
                  <WaButton disabled={sending || !canSend} leftIcon={sending ? Loader2 : Send}>
                    {sending ? 'Sending' : 'Send all'}
                  </WaButton>
                </ZoruAlertDialogTrigger>
                <ZoruAlertDialogContent>
                  <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Confirm bulk send?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                      {lines.length} message{lines.length === 1 ? '' : 's'} will be sent immediately. Charges may apply per recipient and these messages cannot be unsent.
                    </ZoruAlertDialogDescription>
                  </ZoruAlertDialogHeader>
                  <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleSend}>
                      Send {lines.length} message{lines.length === 1 ? '' : 's'}
                    </ZoruAlertDialogAction>
                  </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
              </ZoruAlertDialog>
            </div>
          </div>
        </Section>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Queued" value={lines.length} delay={0} />
            <MetricTile label="Sent" value={result?.success ?? 0} delay={0.05} />
          </div>
          <Section title="Result" description={result ? `${result.total} processed` : 'Idle'}>
            <AnimatePresence mode="wait">
              {sending ? (
                <m.div
                  key="sending"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="flex h-20 items-center justify-center gap-3"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  <p className="text-[13px] text-zinc-600">Sending messages</p>
                </m.div>
              ) : result ? (
                <m.div
                  key="result"
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="h-4 w-4 text-emerald-600" strokeWidth={2.25} aria-hidden />
                    <span className="tabular-nums text-zinc-900">{result.success}</span>
                    <span className="text-zinc-500">sent</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleX className="h-4 w-4 text-rose-600" strokeWidth={2.25} aria-hidden />
                    <span className="tabular-nums text-zinc-900">{result.failed}</span>
                    <span className="text-zinc-500">failed</span>
                  </div>
                </m.div>
              ) : (
                <m.p
                  key="idle"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-center text-[12.5px] text-zinc-500"
                >
                  Enter numbers and a message, then click Send all.
                </m.p>
              )}
            </AnimatePresence>
          </Section>
        </div>
      </div>
    </WaPage>
  );
}
