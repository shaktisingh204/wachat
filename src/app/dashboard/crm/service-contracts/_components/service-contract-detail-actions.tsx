'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  CheckCheck,
  Mail,
  Pencil,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  } from 'lucide-react';

/**
 * <ServiceContractDetailActions> — 9 actions: Edit · Schedule visit ·
 * Renew · Mark closed · Send · Print · Archive · Delete · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteServiceContract,
  updateServiceContractStatus,
} from '@/app/actions/crm-service-contracts.actions';

import {
  ServiceContractRenewDialog,
  ServiceContractScheduleDialog,
  ServiceContractSendDialog,
} from './service-contract-detail-dialogs';

interface ServiceContractDetailActionsProps {
  contractId: string;
  status?: string;
  customerEmail?: string | null;
  periodEnd?: string | null;
}

export function ServiceContractDetailActions({
  contractId,
  status,
  customerEmail,
  periodEnd,
}: ServiceContractDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [renewOpen, setRenewOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const runMarkClosed = () => {
    startTransition(async () => {
      const res = await updateServiceContractStatus(contractId, 'closed');
      if (res.success) {
        toast({ title: 'Marked closed' });
        router.refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/service-contracts/${contractId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setScheduleOpen(true)}
      >
        <Send className="h-3.5 w-3.5" /> Schedule visit
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setRenewOpen(true)}
      >
        <RefreshCcw className="h-3.5 w-3.5" /> Renew
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={runMarkClosed}
        disabled={status === 'closed'}
      >
        <CheckCheck className="h-3.5 w-3.5" /> Mark closed
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setSendOpen(true)}
      >
        <Mail className="h-3.5 w-3.5" /> Send
      </Button>

      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setArchiveOpen(true)}
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/service-contracts/${contractId}/activity`}>
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

      <ServiceContractScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        contractId={contractId}
      />
      <ServiceContractRenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        contractId={contractId}
        initialEnd={periodEnd ?? ''}
      />
      <ServiceContractSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        contractId={contractId}
        initialEmail={customerEmail ?? ''}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this contract?"
        description="The contract is marked closed and hidden from default views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await updateServiceContractStatus(contractId, 'closed');
          if (res.success) {
            toast({ title: 'Archived' });
            router.refresh();
          } else {
            toast({
              title: 'Archive failed',
              description: res.error,
              variant: 'destructive',
            });
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this contract?"
        description="This permanently removes the contract."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteServiceContract(contractId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/service-contracts');
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
