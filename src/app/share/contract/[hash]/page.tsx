import { notFound } from 'next/navigation';
import { getPublicContract } from '@/app/actions/public-contract.actions';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { ContractSignPanel } from './contract-sign-panel';

type Params = Promise<{ hash: string }>;

function formatMoney(amount: number | undefined, currency: string): string {
  if (typeof amount !== 'number') return '—';
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

// Body sanitiser — strip everything except a safe allow-list of tags
// and inline formatting. We deliberately do NOT pull DOMPurify in
// (not currently installed); if it lands later this can be swapped.
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'span',
]);

function sanitiseHtml(raw: string): string {
  // Drop all <script>/<style> blocks entirely, then strip every tag
  // not on the allow-list while keeping the inner text.
  const noBlocks = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  return noBlocks.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (full, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${full.startsWith('</') ? '/' : ''}${tag}>` : '';
  });
}

export default async function PublicContractPage({ params }: { params: Params }) {
  const { hash } = await params;
  const contract = await getPublicContract(hash);
  if (!contract) notFound();

  return (
    <div className="space-y-6">
      <ZoruCard>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>{contract.name || 'Contract'}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {contract.partyFirst && contract.partySecond
                ? `${contract.partyFirst} ⇄ ${contract.partySecond}`
                : null}
            </p>
            <p className="text-xs text-zinc-500">
              Start {formatDate(contract.startDate)} &middot; End {formatDate(contract.endDate)}
              {typeof contract.amount === 'number'
                ? ` · ${formatMoney(contract.amount, contract.currency)}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ZoruBadge variant={contract.signed ? 'default' : 'secondary'}>
              {contract.signed ? 'Signed' : 'Pending signature'}
            </ZoruBadge>
            <a
              href={`/share/contract/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          <article
            className="prose prose-sm max-w-none text-zinc-800"
            dangerouslySetInnerHTML={{ __html: sanitiseHtml(contract.contractDetail || '') }}
          />
        </ZoruCardContent>
      </ZoruCard>

      <ContractSignPanel
        hash={hash}
        signed={contract.signed}
        signedBy={contract.signedBy ?? null}
      />
    </div>
  );
}
