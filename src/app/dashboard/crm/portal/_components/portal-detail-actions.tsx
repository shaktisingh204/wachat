'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Link2,
  Mail,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  } from 'lucide-react';

/**
 * <PortalDetailActions> — 7 actions: Edit · Send magic link · Resend
 * invite · Suspend · Restore · Activity · Delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deletePortalUser,
  restorePortalUser,
  sendMagicLink,
  suspendPortalUser,
  forceLogoutPortalUser,
  sendPasswordReset,
} from '@/app/actions/crm-portal.actions';

interface PortalDetailActionsProps {
  portalUserId: string;
  status?: string;
}

export function PortalDetailActions({
  portalUserId,
  status,
}: PortalDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();

  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const runMagicLink = (resend = false) => {
    startTransition(async () => {
      const res = await sendMagicLink(portalUserId);
      if (res.success) {
        toast({
          title: resend ? 'Invite resent' : 'Magic link sent',
          description: res.magicLink ?? 'Link delivered.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Send failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runForceLogout = () => {
    startTransition(async () => {
      const res = await forceLogoutPortalUser(portalUserId);
      if (res.success) {
        toast({ title: 'Forced logout' });
        router.refresh();
      } else {
        toast({
          title: 'Logout failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runPasswordReset = () => {
    startTransition(async () => {
      const res = await sendPasswordReset(portalUserId);
      if (res.success) {
        toast({ title: 'Password reset sent' });
        router.refresh();
      } else {
        toast({
          title: 'Send failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runRestore = () => {
    startTransition(async () => {
      const res = await restorePortalUser(portalUserId);
      if (res.success) {
        toast({ title: 'Restored' });
        router.refresh();
      } else {
        toast({
          title: 'Restore failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const isSuspended = status === 'suspended';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/portal/${portalUserId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => runMagicLink(false)}
      >
        <Link2 className="h-3.5 w-3.5" /> Send magic link
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => runMagicLink(true)}
      >
        <Mail className="h-3.5 w-3.5" /> Resend invite
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setSuspendOpen(true)}
        disabled={isSuspended}
      >
        <PowerOff className="h-3.5 w-3.5" /> Suspend
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runRestore}
        disabled={!isSuspended}
      >
        <Power className="h-3.5 w-3.5" /> Restore
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runPasswordReset}
      >
        <Mail className="h-3.5 w-3.5" /> Password reset
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runForceLogout}
      >
        <PowerOff className="h-3.5 w-3.5" /> Force Logout
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/portal/${portalUserId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend this portal user?"
        description="The user can't log into the portal until you restore them."
        confirmLabel="Suspend"
        confirmTone="danger"
        onConfirm={async () => {
          const res = await suspendPortalUser(portalUserId);
          if (res.success) {
            toast({ title: 'Suspended' });
            router.refresh();
          } else {
            toast({
              title: 'Suspend failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this portal user?"
        description="This permanently removes the user. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deletePortalUser(portalUserId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/portal');
          } else {
            toast({
              title: 'Delete failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
    </div>
  );
}
