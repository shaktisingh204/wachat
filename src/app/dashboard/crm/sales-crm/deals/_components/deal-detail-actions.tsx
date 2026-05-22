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
  Pencil,
  ArrowRight,
  Mail,
  MessageCircle,
  Printer,
  Archive,
  Trophy,
  CircleX,
  Activity,
  ListPlus,
  } from 'lucide-react';

/**
 * <DealDetailActions> — top-right action group for the deal detail page.
 *
 * Renders the 8+ actions §1D.2 requires (Edit, Convert, Email, WhatsApp,
 * Print, Archive, Mark Won, Mark Lost, Activity, Add Task) plus a
 * clickable status pill whose dropdown changes the deal stage via
 * `updateCrmDealStage`. Email / WhatsApp / Archive / Won-Loss all
 * surface real dialogs now (no more toast stubs).
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { archiveCrmDeal, updateCrmDealStage } from '@/app/actions/crm-deals.actions';

import {
  DealAddTaskDialog,
  DealEmailDialog,
  DealWhatsAppDialog,
  DealWonLossDialog,
} from './deal-dialogs';

interface DealDetailActionsProps {
  dealId: string;
  stage: string;
  stages: string[];
  /** Linked account email for prefilled compose. */
  contactEmail?: string | null;
  /** Linked contact phone for the WhatsApp deep link. */
  contactPhone?: string | null;
  /** Optional won/loss reason vocabulary (pipeline-level config). */
  wonLossReasons?: string[];
}

export function DealDetailActions({
  dealId,
  stage,
  stages,
  contactEmail,
  contactPhone,
  wonLossReasons,
}: DealDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStage, setCurrentStage] = React.useState(stage);
  const [, startTransition] = React.useTransition();

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [wonLossOpen, setWonLossOpen] = React.useState(false);
  const [wonLossOutcome, setWonLossOutcome] = React.useState<'won' | 'lost' | null>(null);
  const [wonLossTargetStage, setWonLossTargetStage] = React.useState('');

  React.useEffect(() => {
    setCurrentStage(stage);
  }, [stage]);

  const moveTo = (next: string) => {
    if (next === currentStage) return;
    const previous = currentStage;
    setCurrentStage(next);
    startTransition(async () => {
      const res = await updateCrmDealStage(dealId, next);
      if (!res.success) {
        setCurrentStage(previous);
        toast({
          title: 'Stage change failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Stage updated', description: `Now in “${next}”.` });
      router.refresh();
    });
  };

  const openWonLoss = (outcome: 'won' | 'lost') => {
    const matcher = outcome === 'won' ? 'won' : 'lost';
    const target = stages.find((s) => s.toLowerCase().includes(matcher));
    if (!target) {
      toast({
        title: `No "${outcome}" stage`,
        description: `Add a ${matcher} stage to this pipeline first.`,
      });
      return;
    }
    setWonLossOutcome(outcome);
    setWonLossTargetStage(target);
    setWonLossOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill → stage-change dropdown */}
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change stage"
          >
            <StatusPill label={currentStage || 'Untriaged'} tone={statusToTone(currentStage)} />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent>
          {stages.map((s) => (
            <ZoruDropdownMenuItem key={s} onSelect={() => moveTo(s)}>
              {s}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/sales-crm/deals/${dealId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=${dealId}`}>
          <ArrowRight className="h-3.5 w-3.5" /> Convert to quotation
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="h-3.5 w-3.5" /> Email
      </Button>

      <Button size="sm" variant="outline" onClick={() => setWhatsAppOpen(true)}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>

      <Button size="sm" variant="outline" onClick={() => setAddTaskOpen(true)}>
        <ListPlus className="h-3.5 w-3.5" /> Add task
      </Button>

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/sales-crm/deals/${dealId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="outline" onClick={() => openWonLoss('won')}>
        <Trophy className="h-3.5 w-3.5" /> Mark won
      </Button>

      <Button size="sm" variant="outline" onClick={() => openWonLoss('lost')}>
        <CircleX className="h-3.5 w-3.5" /> Mark lost
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/sales-crm/deals/${dealId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      {/* Dialogs */}
      <DealEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        dealId={dealId}
        initialTo={contactEmail ?? ''}
      />
      <DealWhatsAppDialog
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        dealId={dealId}
        initialPhone={contactPhone ?? ''}
      />
      <DealAddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        dealId={dealId}
        onCreated={() => router.refresh()}
      />
      <DealWonLossDialog
        open={wonLossOpen}
        onOpenChange={setWonLossOpen}
        dealId={dealId}
        outcome={wonLossOutcome}
        targetStage={wonLossTargetStage}
        reasons={wonLossReasons}
        onCompleted={() => router.refresh()}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this deal?"
        description="The deal is hidden from default views but the data remains. You can restore it later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await archiveCrmDeal(dealId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.refresh();
          } else {
            toast({ title: 'Archive failed', description: res.error, variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
