'use client';

import * as React from 'react';
import { UserPlus, Ban, Copy, LoaderCircle, Trash2 } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  sendUserInvitation,
  revokeInvitation,
  deleteInvitation,
  listInvitations,
} from '@/app/actions/worksuite/chat.actions';
import type {
  WsUserInvitation,
  WsUserInvitationStatus,
} from '@/lib/worksuite/chat-types';

type Row = WsUserInvitation & { _id: string };

export interface InvitationsManagerProps {
  initialInvitations: Row[];
}

const STATUS_TONE: Record<
  WsUserInvitationStatus,
  'amber' | 'green' | 'neutral' | 'red'
> = {
  pending: 'amber',
  accepted: 'green',
  expired: 'neutral',
  revoked: 'red',
};

function formatStamp(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InvitationsManager({ initialInvitations }: InvitationsManagerProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>(initialInvitations);
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const refresh = async () => {
    const latest = (await listInvitations()) as Row[];
    setRows(latest);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const res = await sendUserInvitation(email, roleId || undefined);
    setSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation sent', description: email });
    setEmail('');
    setRoleId('');
    await refresh();
  };

  const handleRevoke = async (id: string) => {
    const res = await revokeInvitation(id);
    if (res.success) {
      toast({ title: 'Invitation revoked' });
      await refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteInvitation(id);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r._id !== id));
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: 'Token copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ClayCard>
        <form
          onSubmit={handleSend}
          className="grid gap-3 md:grid-cols-[1fr_200px_auto]"
          aria-label="Send invitation"
        >
          <div>
            <Label className="text-[11.5px] text-clay-ink-muted" htmlFor="inv-email">
              Email
            </Label>
            <Input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[11.5px] text-clay-ink-muted" htmlFor="inv-role">
              Role id (optional)
            </Label>
            <Input
              id="inv-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              placeholder="role id"
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div className="flex items-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={sending || !email.trim()}
              leading={
                sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Send invitation
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {rows.length === 0 ? (
        <ClayCard className="flex items-center justify-center py-12">
          <p className="text-[13px] text-clay-ink-muted">No invitations yet.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false}>
          <ul className="divide-y divide-clay-border">
            {rows.map((inv) => (
              <li key={inv._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-clay-ink">
                      {inv.email}
                    </span>
                    <ClayBadge tone={STATUS_TONE[inv.status] || 'neutral'}>
                      {inv.status}
                    </ClayBadge>
                    {inv.role_id ? (
                      <ClayBadge tone="neutral">role {inv.role_id}</ClayBadge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-clay-ink-muted">
                    Sent {formatStamp(inv.createdAt)}
                    {inv.expires_at ? ` · Expires ${formatStamp(inv.expires_at)}` : ''}
                    {inv.accepted_at ? ` · Accepted ${formatStamp(inv.accepted_at)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <ClayButton
                    variant="pill"
                    size="sm"
                    onClick={() => copyToken(inv.token)}
                    leading={<Copy className="h-3.5 w-3.5" />}
                  >
                    Copy token
                  </ClayButton>
                  {inv.status === 'pending' ? (
                    <ClayButton
                      variant="pill"
                      size="sm"
                      onClick={() => handleRevoke(inv._id)}
                      leading={<Ban className="h-3.5 w-3.5" />}
                    >
                      Revoke
                    </ClayButton>
                  ) : null}
                  <ClayButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(inv._id)}
                    leading={
                      <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                    }
                  >
                    Delete
                  </ClayButton>
                </div>
              </li>
            ))}
          </ul>
        </ClayCard>
      )}
    </div>
  );
}
