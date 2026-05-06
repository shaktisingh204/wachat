'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, CreditCard, Plus } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { listTelegramBots, type TelegramBotListRow } from '@/app/actions/telegram.actions';
import {
  createTelegramInvoiceAction,
  listTelegramInvoicesAction,
} from '@/app/actions/telegram-extra.actions';
import type { InvoiceRow } from '@/lib/rust-client/telegram-payments';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramPaymentsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('XTR');
  const [amount, setAmount] = useState('1');
  const [payload, setPayload] = useState('');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const refresh = async () => {
    if (!botId) return;
    setInvoices(await listTelegramInvoicesAction(botId));
  };
  useEffect(() => {
    if (botId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const onCreate = () => {
    if (!botId || !title || !description || !amount) return;
    startBusy(async () => {
      const res = await createTelegramInvoiceAction({
        botId,
        title,
        description,
        currency,
        amount: parseInt(amount, 10),
        payload: payload || `inv_${Date.now()}`,
      });
      if (!res.success) {
        toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Invoice created' });
      setOpen(false);
      setTitle('');
      setDescription('');
      setAmount('1');
      setPayload('');
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<CreditCard />} title="No project selected" description="Pick a project." />
      </div>
    );
  }
  if (bots.length === 0) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Bot />}
          title="No bots connected"
          description="Connect a bot first."
          action={<ZoruButton asChild><Link href="/dashboard/telegram/bots">Manage bots</Link></ZoruButton>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
              boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
            }}
          >
            <CreditCard className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Payments</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Telegram invoices (Stars or fiat). Backed by <code>telegram-payments</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bots.map((b) => (
            <ZoruButton
              key={b._id}
              variant={botId === b._id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBotId(b._id)}
            >
              @{b.username}
            </ZoruButton>
          ))}
          <ZoruButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New invoice
          </ZoruButton>
        </div>
      </header>

      {invoices.length === 0 ? (
        <ZoruEmptyState
          icon={<CreditCard />}
          title="No invoices"
          description="Create your first invoice to get a payable Telegram link."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {invoices.map((i) => (
            <ZoruCard key={i._id} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base text-zoru-ink">{i.title}</p>
                  <p className="text-[11px] text-zoru-ink-muted">{safeDate(i.createdAt)}</p>
                </div>
                <ZoruBadge variant="ghost">{i.status}</ZoruBadge>
              </div>
              <p className="line-clamp-2 text-sm text-zoru-ink-muted">{i.description}</p>
              <p className="text-sm">
                <span className="text-zoru-ink">{i.amount}</span>{' '}
                <span className="text-zoru-ink-muted">{i.currency}</span>
              </p>
              {i.invoiceLink && (
                <a
                  href={i.invoiceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[11px] text-zoru-ink underline decoration-zoru-line"
                >
                  {i.invoiceLink}
                </a>
              )}
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New invoice</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="i-title">Title</ZoruLabel>
              <ZoruInput id="i-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <ZoruLabel htmlFor="i-desc">Description</ZoruLabel>
              <ZoruTextarea
                id="i-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <ZoruLabel htmlFor="i-cur">Currency (XTR for Stars)</ZoruLabel>
                <ZoruInput id="i-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div>
                <ZoruLabel htmlFor="i-amt">Amount (smallest unit)</ZoruLabel>
                <ZoruInput
                  id="i-amt"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="i-pay">Payload (optional)</ZoruLabel>
              <ZoruInput id="i-pay" value={payload} onChange={(e) => setPayload(e.target.value)} />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={onCreate}
              disabled={busy || !title || !description || !amount}
            >
              {busy ? 'Creating…' : 'Create'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
