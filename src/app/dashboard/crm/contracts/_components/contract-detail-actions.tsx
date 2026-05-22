'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  Copy,
  FileSignature,
  Mail,
  Pencil,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  XCircle,
  } from 'lucide-react';

/**
 * <ContractDetailActions> — top-right action group on the contract detail
 * page. Mirrors the §1D.2 invoice pattern: 10 actions + clickable status
 * pill. Wires `sendContractForSignature`, `updateContractStatus`,
 * `renewContract`, `voidContract`, `deleteContract` server actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteContract,
  resendContractToSigner,
  updateContractStatus,
} from '@/app/actions/crm-services.actions';

import {
  ContractRenewDialog,
  ContractSendDialog,
  ContractVoidDialog,
} from './contract-dialogs';

type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'terminated';

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

interface ContractDetailActionsProps {
  contractId: string;
  status?: string;
  contactEmail?: string | null;
  endDate?: string | null;
  /**
   * Pending signers (not yet signed) — used for the "Resend invite"
   * sub-action. Each entry should be `{ email, name? }`. Optional;
   * when omitted the resend action is hidden.
   */
  pendingSigners?: Array<{ email: string; name?: string | null }>;
}

export function ContractDetailActions({
  contractId,
  status,
  contactEmail,
  endDate,
  pendingSigners = [],
}: ContractDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState<ContractStatus>(
    (status as ContractStatus) ?? 'draft',
  );
  const [, startTransition] = React.useTransition();

  const [sendOpen, setSendOpen] = React.useState(false);
  const [renewOpen, setRenewOpen] = React.useState(false);
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setCurrentStatus(((status as ContractStatus) ?? 'draft') as ContractStatus);
  }, [status]);

  const moveTo = (next: ContractStatus) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateContractStatus(contractId, next);
      if (!res.success) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Status updated', description: `Now ${next}` });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <ZoruDropdownMenuItem
              key={s.value}
              onSelect={() => moveTo(s.value)}
            >
              {s.label}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/contracts/${contractId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
        <Send className="h-3.5 w-3.5" /> Send for signature
      </Button>

      {pendingSigners.length > 0 ? (
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Mail className="h-3.5 w-3.5" /> Resend invite
            </Button>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent>
            {pendingSigners.map((s) => (
              <ZoruDropdownMenuItem
                key={s.email}
                onSelect={() => {
                  startTransition(async () => {
                    const res = await resendContractToSigner(contractId, s.email);
                    if (res.success) {
                      toast({
                        title: 'Invite resent',
                        description: s.email,
                      });
                      router.refresh();
                    } else {
                      toast({
                        title: 'Resend failed',
                        description: res.error ?? 'Unknown error',
                        variant: 'destructive',
                      });
                    }
                  });
                }}
              >
                {s.name ? `${s.name} (${s.email})` : s.email}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        onClick={() => moveTo('signed')}
      >
        <FileSignature className="h-3.5 w-3.5" /> Mark signed
      </Button>

      <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
        <RefreshCcw className="h-3.5 w-3.5" /> Renew
      </Button>

      <Button size="sm" variant="outline" onClick={() => setVoidOpen(true)}>
        <XCircle className="h-3.5 w-3.5" /> Void
      </Button>

      <Button size="sm" variant="outline" asChild>
        <a
          href={`mailto:${contactEmail ?? ''}?subject=${encodeURIComponent('Your contract')}`}
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </a>
      </Button>

      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>

      <Button size="sm" variant="outline" asChild>
        {/* TODO 1D.2: server-side duplicate endpoint not yet available — link to new page */}
        <Link href={`/dashboard/crm/contracts?fromKind=contract&fromId=${contractId}`}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/contracts/${contractId}/activity`}>
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

      <ContractSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        contractId={contractId}
        initialEmail={contactEmail ?? ''}
      />
      <ContractRenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        contractId={contractId}
        initialEndDate={endDate ?? ''}
      />
      <ContractVoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        contractId={contractId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this contract?"
        description="The contract is marked terminated and hidden from default views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await updateContractStatus(contractId, 'terminated');
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
        description="This permanently removes the contract. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteContract(contractId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/contracts');
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
