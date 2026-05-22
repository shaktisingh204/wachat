import { notFound } from 'next/navigation';
import { getPublicProposal } from '@/app/actions/public-proposal.actions';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { ProposalActionsPanel } from './proposal-actions-panel';

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  accepted: 'default',
  declined: 'destructive',
  waiting: 'secondary',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Minimal HTML escape — we render the proposal body as plain text by
// default to keep this layer safe. If/when a sanitizer is added at the
// project level this can be swapped for sanitized HTML.
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function PublicProposalPage({ params }: { params: Params }) {
  const { hash } = await params;
  const proposal = await getPublicProposal(hash);
  if (!proposal) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>{proposal.title || 'Proposal'}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Valid till {formatDate(proposal.validTill)} &middot; Total{' '}
              {formatMoney(proposal.total, proposal.currency)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[proposal.status] || 'outline'}>
              {proposal.status}
            </Badge>
            <a
              href={`/share/proposal/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          {proposal.body ? (
            <article
              className="prose prose-sm max-w-none text-zinc-800"
              // Body is escaped at render time; raw HTML would need a
              // DOMPurify pass before being trusted.
              dangerouslySetInnerHTML={{
                __html: escapeHtml(proposal.body).replace(/\n/g, '<br />'),
              }}
            />
          ) : (
            <p className="text-sm text-zinc-500">No proposal body provided.</p>
          )}
        </ZoruCardContent>
      </Card>

      <ProposalActionsPanel
        hash={hash}
        status={proposal.status}
        signature={proposal.signature ?? null}
        declineReason={proposal.declineReason ?? null}
      />
    </div>
  );
}
