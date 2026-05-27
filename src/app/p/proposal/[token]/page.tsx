import { fmtINR } from '@/lib/utils';
import React from "react";
import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Badge,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/zoruui';
import { fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ProposalSignForm } from './_form';
import { FileText, Database, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

async function PublicProposalPageContent({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'proposal') {
    return <InvalidLinkCard />;
  }
  const { proposal, items, signs } = result.resource as {
    proposal: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
    signs: Array<Record<string, unknown>>;
  };
  const currency = String(proposal.currency || 'INR');
  const isAccepted = proposal.status === 'accepted';
  const signatureRequired = !!proposal.signature_required;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* LEFT COLUMN: Specification & Documentation (60%) */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-zoru-surface-2 border border-zoru-line px-2 py-0.5 font-mono text-[11px] font-bold text-zoru-ink uppercase">
              GET
            </span>
            <span className="font-mono text-[13px] text-zoru-ink tracking-tight">
              /v1/proposals/{token.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zoru-ink font-mono">
            {String(proposal.proposal_number || 'PROPOSAL-SPECIFICATION')} · {String(proposal.title || 'Proposal')}
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Below is the comprehensive contract/service proposal detail schema and line items.
          </p>
        </div>

        {/* METADATA TABLE */}
        <Card>
          <ZoruCardHeader className="border-b border-zoru-line py-3 bg-zoru-surface-2/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-zoru-ink-muted">
                Document Ledger Variables
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-zoru-surface-2/20">
                <ZoruTableRow>
                  <ZoruTableHead className="font-mono text-[11.5px]">Ledger Attribute</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px] text-right">Value</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">issue_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(proposal.issue_date)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">valid_until</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(proposal.valid_until)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">tax_rate</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtINR(Number(proposal.tax || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">subtotal</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtINR(Number(proposal.subtotal || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">proposal_total</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[13px] font-bold text-zoru-ink bg-zoru-surface-2/40">{fmtINR(Number(proposal.total || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">proposal_status</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant={isAccepted ? 'success' : proposal.status === 'sent' ? 'warning' : 'outline'}>
                      {String(proposal.status || 'DRAFT').toUpperCase()}
                    </Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>

        {/* LINE ITEMS */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-zoru-ink-muted px-1">
            <Layers className="h-4 w-4" />
            <span>Structured Line Items (Proposal Nodes)</span>
          </div>
          <Card>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableHeader className="bg-zoru-surface-2/15">
                  <ZoruTableRow>
                    <ZoruTableHead className="font-mono text-[11px]">Item Node</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11px] text-right">Qty</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11px] text-right">Unit Rate</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11px] text-right">Aggregate</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {items.map((it, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell className="align-top py-3.5">
                        <div className="font-bold text-[13px] text-zoru-ink font-mono">{String(it.name || '')}</div>
                        {it.description ? (
                          <div className="mt-1 text-[12px] text-zoru-ink-muted leading-normal font-medium max-w-md">
                            {String(it.description)}
                          </div>
                        ) : null}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] font-bold text-zoru-ink">
                        {Number(it.quantity || 0)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] text-zoru-ink-muted">
                        {fmtINR(Number(it.unit_price || 0), currency)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] font-bold text-zoru-ink">
                        {fmtINR(Number(it.total || 0), currency)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        </div>

        {/* NOTES & TERMS */}
        {proposal.note || proposal.terms ? (
          <div className="grid gap-4 md:grid-cols-2">
            {proposal.note ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zoru-ink-muted px-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  // notes
                </span>
                <div className="rounded-xl border border-zoru-line bg-zoru-surface-2/35 p-4 text-[13px] leading-relaxed text-zoru-ink shadow-sm">
                  <pre className="whitespace-pre-wrap font-sans font-medium">{String(proposal.note)}</pre>
                </div>
              </div>
            ) : null}

            {proposal.terms ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zoru-ink-muted px-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  // terms_conditions
                </span>
                <div className="rounded-xl border border-zoru-line bg-zoru-surface-2/35 p-4 text-[13px] leading-relaxed text-zoru-ink shadow-sm">
                  <pre className="whitespace-pre-wrap font-sans font-medium">{String(proposal.terms)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* VERIFIED SIGNATURES */}
        {isAccepted && (
          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted px-1">
              // VERIFIED.SIGNATURES
            </h3>
            {signs.length === 0 ? (
              <p className="py-2 text-[12.5px] text-zoru-ink-muted font-mono italic px-1">
                // No signature blobs attached to accepted proposal state.
              </p>
            ) : (
              <div className="grid gap-3">
                {signs.map((s, i) => (
                  <Card key={i} className="border-success/20 bg-success/5 shadow-sm">
                    <ZoruCardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap font-mono">
                        <div>
                          <p className="text-[13px] font-bold text-zoru-ink">
                            {String(s.signer_name || '')}
                          </p>
                          <p className="text-[11.5px] text-zoru-ink-muted">
                            {String(s.signer_email || '')}
                          </p>
                        </div>
                        <span className="text-[11px] bg-success/10 border border-success/20 px-2 py-0.5 rounded text-success-ink uppercase">
                          Crypto-Verified {fmtDateTime(s.signed_at)}
                        </span>
                      </div>
                    </ZoruCardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Active Request Form & JSON Runner (40%) */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-zoru-surface-2 border border-zoru-line px-2 py-0.5 font-mono text-[11px] font-bold text-zoru-ink uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-zoru-ink tracking-tight">
              /v1/proposals/{token.slice(0, 8)}.../accept
            </span>
          </div>

          {isAccepted ? (
            <Card className="border-success/20 bg-success/5">
              <ZoruCardContent className="py-8 text-center flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
                  200
                </div>
                <div>
                  <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
                    // PROPOSAL.ACCEPTED
                  </h3>
                  <p className="mt-1 text-[12.5px] text-zoru-ink-muted font-sans">
                    This proposal is approved and executed by both parties.
                  </p>
                </div>
                <div className="mt-4 w-full rounded border border-zoru-line bg-zoru-surface p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                  <span className="text-zoru-ink-muted">{"{"}</span>
                  <div className="pl-4">
                    <span className="text-zoru-ink">&quot;status&quot;</span>: <span className="text-zoru-ink">&quot;accepted&quot;</span>,
                    <br />
                    <span className="text-zoru-ink">&quot;executed&quot;</span>: <span className="text-zoru-ink">true</span>,
                    <br />
                    <span className="text-zoru-ink">&quot;code&quot;</span>: <span className="text-zoru-ink">200</span>
                  </div>
                  <span className="text-zoru-ink-muted">{"}"}</span>
                </div>
              </ZoruCardContent>
            </Card>
          ) : signatureRequired ? (
            <ProposalSignForm token={token} />
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default function PublicProposalPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PublicProposalPageContent params={params} />
    </React.Suspense>
  );
}
