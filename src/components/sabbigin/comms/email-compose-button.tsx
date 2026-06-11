'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';

import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { sendSabbiginEmail } from '@/app/actions/sabbigin-email.actions';

export function EmailComposeButton({
  contactId,
  dealId,
  defaultTo,
  size = 'sm',
}: {
  contactId?: string;
  dealId?: string;
  defaultTo?: string;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState(defaultTo ?? '');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  async function send() {
    setSending(true);
    const res = await sendSabbiginEmail({ to, subject, body, contactId, dealId });
    setSending(false);
    if (res.success) {
      toast.success({ title: 'Email sent', description: `To ${to}` });
      setOpen(false);
      setSubject('');
      setBody('');
      router.refresh();
    } else {
      toast.error({ title: 'Could not send', description: res.error });
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        iconLeft={<Mail size={14} />}
        onClick={() => {
          setTo(defaultTo ?? '');
          setOpen(true);
        }}
      >
        Email
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" className="w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>New email</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-3 p-4">
            <Field label="To">
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@company.com"
              />
            </Field>
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Message">
              <Textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message…"
              />
            </Field>
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              Sent through SabMail and logged to this record's timeline.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={sending}
                disabled={!to || !subject}
                onClick={send}
              >
                Send
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
