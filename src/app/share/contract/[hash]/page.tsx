import * as React from 'react';
import { notFound } from 'next/navigation';
import { getPublicContract } from '@/app/actions/public-contract.actions';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { ContractSignPanel } from './contract-sign-panel';
import DOMPurify from 'isomorphic-dompurify';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

function sanitiseHtml(raw: string): string {
  return DOMPurify.sanitize(raw);
}

async function PublicContractContainer({ hash }: { hash: string }) {
  const contract = await getPublicContract(hash);
  if (!contract) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{contract.name || 'Contract'}</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text)]">
              {contract.partyFirst && contract.partySecond
                ? `${contract.partyFirst} ⇄ ${contract.partySecond}`
                : null}
            </p>
            <p className="text-xs text-[var(--st-text)]">
              Start {fmtDate(contract.startDate)} &middot; End {fmtDate(contract.endDate)}
              {typeof contract.amount === 'number'
                ? ` · ${fmtINR(contract.amount)}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={contract.signed ? 'default' : 'secondary'}>
              {contract.signed ? 'Signed' : 'Pending signature'}
            </Badge>
            <a
              href={`/share/contract/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--st-text)] shadow-sm hover:bg-[var(--st-bg-muted)]"
            >
              Download PDF
            </a>
          </div>
        </CardHeader>
        <CardBody>
          <article
            className="prose prose-sm max-w-none text-[var(--st-text)]"
            dangerouslySetInnerHTML={{ __html: sanitiseHtml(contract.contractDetail || '') }}
          />
        </CardBody>
      </Card>

      <ContractSignPanel
        hash={hash}
        signed={contract.signed}
        signatures={contract.signatures ?? []}
      />
    </div>
  );
}

export default async function PublicContractPage({ params }: { params: Params }) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading contract...</div>}>
      <PublicContractContainer hash={hash} />
    </React.Suspense>
  );
}
