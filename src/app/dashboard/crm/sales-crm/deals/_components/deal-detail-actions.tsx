'use client';

/**
 * <DealDetailActions> — top-right action group for the deal detail page.
 *
 * Renders the 8+ actions §1D.2 requires (Edit, Convert, Email, WhatsApp,
 * Print, Archive, Mark Won, Mark Lost, Activity) plus a clickable status
 * pill whose dropdown changes the deal stage via `updateCrmDealStage`.
 *
 * "Email" / "WhatsApp" / "Print" / "Archive" surface as toasts until the
 * respective compose dialogs / archive endpoint ship — keeps the slot
 * shape stable so consumers don't have to refactor when they do land.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateCrmDealStage } from '@/app/actions/crm-deals.actions';

interface DealDetailActionsProps {
  dealId: string;
  stage: string;
  stages: string[];
}

export function DealDetailActions({ dealId, stage, stages }: DealDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStage, setCurrentStage] = React.useState(stage);
  const [, startTransition] = React.useTransition();

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

  const placeholder = (label: string, description: string) =>
    toast({ title: label, description });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill → stage-change dropdown */}
      <ZoruDropdownMenu>
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
      </ZoruDropdownMenu>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/sales-crm/deals/${dealId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=${dealId}`}>
          <ArrowRight className="h-3.5 w-3.5" /> Convert to quotation
        </Link>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() =>
          placeholder('Compose email', 'Email dialog wires in with the sales-comms sweep.')
        }
      >
        <Mail className="h-3.5 w-3.5" /> Email
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() =>
          placeholder('Send WhatsApp', 'WhatsApp template send queued — same sweep as Email.')
        }
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => {
          if (typeof window !== 'undefined') window.print();
        }}
      >
        <Printer className="h-3.5 w-3.5" /> Print
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() =>
          placeholder('Archive', 'Archive endpoint ships with the dual-impl deals action.')
        }
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => {
          const wonStage = stages.find((s) => s.toLowerCase().includes('won'));
          if (wonStage) moveTo(wonStage);
          else placeholder('No "Won" stage', 'Add a Won stage to this pipeline first.');
        }}
      >
        <Trophy className="h-3.5 w-3.5" /> Mark won
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => {
          const lostStage = stages.find((s) => s.toLowerCase().includes('lost'));
          if (lostStage) moveTo(lostStage);
          else placeholder('No "Lost" stage', 'Add a Lost stage to this pipeline first.');
        }}
      >
        <CircleX className="h-3.5 w-3.5" /> Mark lost
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/sales-crm/deals/${dealId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </ZoruButton>
    </div>
  );
}
