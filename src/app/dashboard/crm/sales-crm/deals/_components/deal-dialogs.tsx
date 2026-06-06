'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
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
/**
 * Shared dialogs for the Deals detail action group.
 *
 * Extracted so the action-bar component stays small and the dialog
 * markup is reusable from both the detail page and the list page row
 * actions. None of these are wired to a "real" send pipeline yet — they
 * persist an audit trail and (where appropriate) open a wa.me deep link
 * so the user can finish the send in the WhatsApp client.
 */

import * as React from 'react';

import { sendDealEmail, updateCrmDeal } from '@/app/actions/crm-deals.actions';

/* ─── Email composer ─────────────────────────────────────────────────── */

interface DealEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  initialTo?: string;
}

export function DealEmailDialog({
  open,
  onOpenChange,
  dealId,
  initialTo = '',
}: DealEmailDialogProps) {
  const { toast } = useZoruToast();
  const [to, setTo] = React.useState(initialTo);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setTo(initialTo);
  }, [open, initialTo]);

  const handleSend = async () => {
    if (!to || !subject) {
      toast({ title: 'Missing fields', description: 'To and subject are required.', variant: 'destructive' });
      return;
    }
    setPending(true);
    const res = await sendDealEmail({ dealId, to, subject, body });
    setPending(false);
    if (res.success) {
      toast({ title: 'Email queued', description: 'Audit entry recorded; SMTP relay lands with comms sweep.' });
      onOpenChange(false);
      setSubject('');
      setBody('');
    } else {
      toast({ title: 'Failed', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Compose email</ZoruDialogTitle>
          <ZoruDialogDescription>
            Quick-compose a message — the SMTP relay lands later but the audit is recorded now.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="deal-email-to">To</Label>
            <Input
              id="deal-email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="deal-email-subject">Subject</Label>
            <Input
              id="deal-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Update on your opportunity"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="deal-email-body">Body</Label>
            <Textarea
              id="deal-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write your message…"
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            {pending ? 'Sending…' : 'Send'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ─── WhatsApp composer ──────────────────────────────────────────────── */

interface DealWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  initialPhone?: string;
  /** Optional template messages to pick from. */
  templates?: { id: string; name: string; body: string }[];
}

const DEFAULT_TEMPLATES = [
  { id: 'intro', name: 'Introduction', body: 'Hi {name}, this is {sender}. Reaching out about your opportunity.' },
  { id: 'follow-up', name: 'Follow-up', body: 'Hi {name}, just following up on our discussion. Let me know your thoughts.' },
  { id: 'reminder', name: 'Reminder', body: 'Hi {name}, gentle reminder about the proposal we shared.' },
];

export function DealWhatsAppDialog({
  open,
  onOpenChange,
  dealId,
  initialPhone = '',
  templates = DEFAULT_TEMPLATES,
}: DealWhatsAppDialogProps) {
  const { toast } = useZoruToast();
  const [phone, setPhone] = React.useState(initialPhone);
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '');
  const [message, setMessage] = React.useState(templates[0]?.body ?? '');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setPhone(initialPhone);
  }, [open, initialPhone]);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setMessage(t.body);
  };

  const handleSend = async () => {
    const clean = phone.replace(/[^0-9+]/g, '');
    if (!clean) {
      toast({ title: 'Phone required', variant: 'destructive' });
      return;
    }
    setPending(true);
    // Write audit row (best-effort) then open wa.me link.
    const res = await sendDealEmail({
      dealId,
      to: `whatsapp:${clean}`,
      subject: 'WhatsApp send',
      body: message,
    });
    setPending(false);
    if (typeof window !== 'undefined') {
      const url = `https://wa.me/${clean.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    if (res.success) toast({ title: 'WhatsApp opened', description: 'Audit row recorded.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Send via WhatsApp</ZoruDialogTitle>
          <ZoruDialogDescription>Opens WhatsApp Web/App with your prepared message.</ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="deal-wa-phone">Phone (with country code)</Label>
            <Input
              id="deal-wa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9999900000"
            />
          </div>
          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {templates.map((t) => (
                  <ZoruSelectItem key={t.id} value={t.id}>
                    {t.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="deal-wa-msg">Message</Label>
            <Textarea
              id="deal-wa-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            {pending ? 'Opening…' : 'Open WhatsApp'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ─── Won/Lost reason capture ────────────────────────────────────────── */

interface DealWonLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  outcome: 'won' | 'lost' | null;
  targetStage: string;
  /** Predefined reasons; falls back to free-text only. */
  reasons?: string[];
  onCompleted: () => void;
}

export function DealWonLossDialog({
  open,
  onOpenChange,
  dealId,
  outcome,
  targetStage,
  reasons,
  onCompleted,
}: DealWonLossDialogProps) {
  const { toast } = useZoruToast();
  const [pickedReason, setPickedReason] = React.useState<string>('');
  const [freeReason, setFreeReason] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPickedReason('');
      setFreeReason('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!outcome) return;
    const reason = pickedReason && pickedReason !== '__custom__' ? pickedReason : freeReason.trim();
    setPending(true);
    const res = await updateCrmDeal(dealId, {
      stage: targetStage,
      status: outcome,
      wonLossReason: reason || null,
      lossReason: outcome === 'lost' ? reason || null : null,
    });
    setPending(false);
    if (res.success) {
      toast({ title: outcome === 'won' ? 'Marked won' : 'Marked lost' });
      onCompleted();
      onOpenChange(false);
    } else {
      toast({ title: 'Failed', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {outcome === 'won' ? 'Mark deal as won' : 'Mark deal as lost'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Record why this deal {outcome === 'won' ? 'closed' : 'was lost'} — it powers your
            pipeline analytics.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          {/* TODO 1E.sweep: `reasons` is a runtime list from props (per-tenant
              configured win/loss reasons). Once we model `dealReasonsEnum` as
              a Mongo-backed enum, this becomes an `<EnumFormField>`; for now
              the raw Select is preserved so the inline-custom sentinel
              still works. */}
          {Array.isArray(reasons) && reasons.length > 0 ? (
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={pickedReason} onValueChange={setPickedReason}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select a reason" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {reasons.map((r) => (
                    <ZoruSelectItem key={r} value={r}>
                      {r}
                    </ZoruSelectItem>
                  ))}
                  <ZoruSelectItem value="__custom__">Other (write below)</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          ) : null}
          {(!reasons || reasons.length === 0 || pickedReason === '__custom__') ? (
            <div className="space-y-1">
              <Label htmlFor="deal-wl-reason">Custom reason</Label>
              <Textarea
                id="deal-wl-reason"
                value={freeReason}
                onChange={(e) => setFreeReason(e.target.value)}
                rows={3}
                placeholder="e.g. Budget shifted, picked a competitor"
              />
            </div>
          ) : null}
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            {pending ? 'Saving…' : outcome === 'won' ? 'Mark won' : 'Mark lost'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ─── Add Task dialog (quick-create from detail) ─────────────────────── */

interface DealAddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onCreated: () => void;
}

export function DealAddTaskDialog({
  open,
  onOpenChange,
  dealId,
  onCreated,
}: DealAddTaskDialogProps) {
  const { toast } = useZoruToast();
  const [title, setTitle] = React.useState('');
  const [due, setDue] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      if (due) fd.append('dueDate', due);
      fd.append('linkedKind', 'deal');
      fd.append('linkedId', dealId);
      fd.append('intent', 'save');
      const { createCrmTask } = await import('@/app/actions/crm-tasks.actions');
      const res = await (createCrmTask as any)(undefined, fd);
      if (res?.taskId) {
        toast({ title: 'Task created' });
        setTitle('');
        setDue('');
        onCreated();
        onOpenChange(false);
      } else {
        toast({ title: 'Failed', description: res?.error ?? 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Add task</ZoruDialogTitle>
          <ZoruDialogDescription>Linked to this deal.</ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="deal-task-title">Title</Label>
            <Input
              id="deal-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up on proposal"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="deal-task-due">Due date</Label>
            <Input
              id="deal-task-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? 'Saving…' : 'Create task'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
