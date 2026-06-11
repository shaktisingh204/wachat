'use client';

import React from 'react';
import Link from 'next/link';
import { MessageCircle, Send } from 'lucide-react';

import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Input,
  EmptyState,
  toast,
} from '@/components/sabcrm/20ui';
import {
  getSabbiginWhatsappThread,
  sendSabbiginWhatsapp,
  type SabbiginWhatsappThread,
} from '@/app/actions/sabbigin-whatsapp.actions';
import { relativeTime } from '@/components/sabbigin/lib/format';

export function WhatsAppButton({
  contactId,
  size = 'sm',
}: {
  contactId: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [thread, setThread] = React.useState<SabbiginWhatsappThread | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);

  async function load() {
    setLoading(true);
    const t = await getSabbiginWhatsappThread(contactId);
    setThread(t);
    setLoading(false);
  }

  React.useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send() {
    if (!thread?.connected || !draft.trim()) return;
    setSending(true);
    const res = await sendSabbiginWhatsapp({
      projectId: thread.projectId!,
      phoneNumberId: thread.phoneNumberId!,
      waId: thread.waId!,
      wachatContactId: thread.wachatContactId!,
      text: draft,
    });
    setSending(false);
    if (res.success) {
      setDraft('');
      toast.success({ title: 'WhatsApp sent' });
      void load();
    } else {
      toast.error({ title: 'Could not send', description: res.error });
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        iconLeft={<MessageCircle size={14} />}
        onClick={() => setOpen(true)}
      >
        WhatsApp
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" className="flex w-full max-w-md flex-col">
          <DrawerHeader>
            <DrawerTitle>WhatsApp</DrawerTitle>
          </DrawerHeader>

          {loading ? (
            <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
          ) : !thread?.connected ? (
            <div className="p-4">
              <EmptyState
                icon={MessageCircle}
                title="No conversation yet"
                description={thread?.reason ?? 'Connect WhatsApp to chat with this contact.'}
                action={
                  <Link href="/wachat" className="u-btn u-btn--primary u-btn--sm">
                    <span className="u-btn__label">Open WaChat</span>
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--st-text-secondary)]">
                    No messages yet. Say hello 👋
                  </p>
                ) : (
                  thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          m.direction === 'out'
                            ? 'bg-[var(--st-accent,#25d366)] text-white'
                            : 'bg-[var(--st-surface-2,#f1f1f1)] text-[var(--st-text)]'
                        }`}
                      >
                        <div>{m.text || `[${m.type}]`}</div>
                        <div className="mt-0.5 text-[10px] opacity-70">
                          {relativeTime(m.timestamp)}
                          {m.direction === 'out' && m.status ? ` · ${m.status}` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--st-border)] p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') send();
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={<Send size={14} />}
                  loading={sending}
                  disabled={!draft.trim()}
                  onClick={send}
                >
                  {''}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
