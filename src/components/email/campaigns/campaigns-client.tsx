'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Send, MoreHorizontal, Trash2, FileText, Mail } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  zoruToast,
} from '@/components/zoruui';
import {
  actionCreateEmailCampaign,
  actionDeleteEmailCampaign,
  actionListEmailCampaigns,
  actionSendEmailCampaign,
  type EmailCampaignDoc,
} from '@/app/actions/email/campaigns.actions';

const STATUS_VARIANTS: Record<EmailCampaignDoc['status'], 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  sending: 'default',
  sent: 'default',
  paused: 'outline',
  cancelled: 'outline',
  failed: 'outline',
};

export function EmailCampaignsClient() {
  const [campaigns, setCampaigns] = useState<EmailCampaignDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await actionListEmailCampaigns({ limit: 50 });
    if (!r.ok) {
      zoruToast({ title: 'Failed to load campaigns', description: r.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setCampaigns(r.data.items);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleSend = async (c: EmailCampaignDoc) => {
    const r = await actionSendEmailCampaign(c._id);
    if (!r.ok) { zoruToast({ title: 'Send failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: `Campaign "${c.name}" queued for delivery` });
    refresh();
  };

  const handleDelete = async (c: EmailCampaignDoc) => {
    const r = await actionDeleteEmailCampaign(c._id);
    if (!r.ok) { zoruToast({ title: 'Delete failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: 'Campaign deleted' });
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Send className="h-6 w-6" /> Campaigns
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>Compose, schedule and send broadcasts to your audience.</ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="No campaigns yet"
          description="Create your first campaign to start reaching subscribers."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New campaign</Button>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Subject</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Sent / Scheduled</ZoruTableHead>
                <ZoruTableHead className="w-[60px]" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {campaigns.map((c) => (
                <ZoruTableRow key={c._id}>
                  <ZoruTableCell>
                    <Link href={`/dashboard/email/campaigns/${c._id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-zoru-ink-muted">{c.fromName} &lt;{c.fromEmail}&gt;</p>
                  </ZoruTableCell>
                  <ZoruTableCell className="truncate max-w-sm">{c.subject}</ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={STATUS_VARIANTS[c.status] ?? 'outline'}>{c.status}</Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted text-sm">
                    {c.sentAt
                      ? `Sent ${formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}`
                      : c.scheduledAt
                        ? `Scheduled ${formatDistanceToNow(new Date(c.scheduledAt), { addSuffix: true })}`
                        : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onSelect={() => handleSend(c)} disabled={c.status !== 'draft'}>
                          <Send className="h-4 w-4" /> Send now
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/email/campaigns/${c._id}`}>
                            <FileText className="h-4 w-4" /> Open
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onSelect={() => handleDelete(c)} className="text-zoru-ink">
                          <Trash2 className="h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </Card>
      )}

      <NewCampaignDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  );
}

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewCampaignDialog({ open, onOpenChange, onCreated }: NewCampaignDialogProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [body, setBody] = useState('<p>Hello {{ firstName }},</p>\n<p>…</p>');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!name.trim() || !subject.trim() || !fromEmail.trim()) {
      zoruToast({ title: 'Name, subject, and from email are required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const r = await actionCreateEmailCampaign({
        name: name.trim(),
        subject: subject.trim(),
        fromName: fromName.trim() || 'SabNode',
        fromEmail: fromEmail.trim(),
        body,
      });
      if (!r.ok) { zoruToast({ title: 'Create failed', description: r.error, variant: 'destructive' }); return; }
      zoruToast({ title: 'Campaign created as draft' });
      setName(''); setSubject(''); setFromName(''); setFromEmail(''); setBody('');
      onCreated();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>New campaign</ZoruDialogTitle>
          <ZoruDialogDescription>Start a draft. You can refine the audience, design and schedule before sending.</ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label htmlFor="c-name">Internal name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Black Friday — Day 1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-subj">Subject line</Label>
            <Input id="c-subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="🔥 24h only: 40% off everything" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="c-fn">From name</Label>
              <Input id="c-fn" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Acme" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-fe">From email</Label>
              <Input id="c-fe" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@acme.com" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-body">Body (HTML)</Label>
            <Textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="font-mono text-xs" />
            <p className="text-xs text-zoru-ink-muted">Use the template builder for richer content. Merge tags: <code>{'{{'} firstName {'}}'}</code>, <code>{'{{'} email {'}}'}</code>, <code>{'{{'} unsubscribeUrl {'}}'}</code>.</p>
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Create draft'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
