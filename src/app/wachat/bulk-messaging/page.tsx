'use client';

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  Field,
  Progress,
  Spinner,
  Textarea,
} from '@/components/sabcrm/20ui';
import {
  useState } from 'react';
import { CircleCheck,
  CircleX,
  Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Bulk Messaging — send messages to multiple numbers at once.
 * 20ui rebuild. Same handler (sendBulkMessages); only chrome is new.
 */

import { sendBulkMessages } from '@/app/actions/wachat-features.actions';

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
        tone: 'danger',
      });
      return;
    }
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'No project selected.',
        tone: 'danger',
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
        tone: 'danger',
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
        tone: 'success',
      });
    }
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Bulk Messaging' },
      ]}
      title="Bulk Messaging"
      description="Send a message to multiple phone numbers at once."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-4">
          <Field label="Phone numbers (one per line)">
            <Textarea
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              rows={6}
              disabled={sending}
              placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
              className="font-mono"
            />
          </Field>
          <Field label="Message">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={sending}
              placeholder="Type your message here..."
            />
          </Field>
          <div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="primary"
                  iconLeft={Send}
                  loading={sending}
                  disabled={sending || !canSend}
                >
                  {sending ? 'Sending…' : 'Send all'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm bulk send?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {lines.length} message{lines.length === 1 ? '' : 's'} will
                    be sent immediately. Charges may apply per recipient and
                    these messages cannot be unsent.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction intent="primary" onClick={handleSend}>
                    Send {lines.length} message
                    {lines.length === 1 ? '' : 's'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>

        <Card padding="lg">
          <h2
            className="mb-4 text-sm"
            style={{ color: 'var(--st-text)' }}
          >
            Result
          </h2>
          {sending ? (
            <div className="flex h-20 items-center justify-center gap-3">
              <Spinner size="md" label="Sending messages" />
              <p
                className="text-[13px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                Sending messages…
              </p>
            </div>
          ) : result ? (
            <>
              <Progress value={100} tone="success" className="mb-4" />
              <p
                className="mb-4 text-[13px]"
                style={{ color: 'var(--st-text)' }}
              >
                {result.total} processed
              </p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <CircleCheck
                    className="h-4 w-4"
                    style={{ color: 'var(--st-status-ok)' }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: 'var(--st-text)' }}
                  >
                    {result.success} sent
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CircleX
                    className="h-4 w-4"
                    style={{ color: 'var(--st-danger)' }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: 'var(--st-text)' }}
                  >
                    {result.failed} failed
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p
              className="py-8 text-center text-[13px]"
              style={{ color: 'var(--st-text-secondary)' }}
            >
              Enter numbers and a message, then click Send all.
            </p>
          )}
        </Card>
      </div>
    </WachatPage>
  );
}
