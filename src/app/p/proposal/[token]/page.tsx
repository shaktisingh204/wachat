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
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ProposalSignForm } from './_form';
import { FileText, Database, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: PageProps) {
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
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-blue-600 uppercase">
              GET
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
              /v1/proposals/{token.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {String(proposal.proposal_number || 'PROPOSAL-SPECIFICATION')} · {String(proposal.title || 'Proposal')}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Below is the comprehensive contract/service proposal detail schema and line items.
          </p>
        </div>

        {/* METADATA TABLE */}
        <Card>
          <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
                Document Ledger Variables
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-secondary/20">
                <ZoruTableRow>
                  <ZoruTableHead className="font-mono text-[11.5px]">Ledger Attribute</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px] text-right">Value</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">issue_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(proposal.issue_date)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">valid_until</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(proposal.valid_until)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">tax_rate</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtCurrency(Number(proposal.tax || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">subtotal</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtCurrency(Number(proposal.subtotal || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">proposal_total</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[13px] font-bold text-foreground bg-secondary/40">{fmtCurrency(Number(proposal.total || 0), currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">proposal_status</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">string</ZoruTableCell>
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
          <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground px-1">
            <Layers className="h-4 w-4" />
            <span>Structured Line Items (Proposal Nodes)</span>
          </div>
          <Card>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableHeader className="bg-secondary/15">
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
                        <div className="font-bold text-[13px] text-foreground font-mono">{String(it.name || '')}</div>
                        {it.description ? (
                          <div className="mt-1 text-[12px] text-muted-foreground leading-normal font-medium max-w-md">
                            {String(it.description)}
                          </div>
                        ) : null}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] font-bold text-foreground">
                        {Number(it.quantity || 0)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] text-muted-foreground">
                        {fmtCurrency(Number(it.unit_price || 0), currency)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right align-top py-3.5 font-mono text-[12.5px] font-bold text-foreground">
                        {fmtCurrency(Number(it.total || 0), currency)}
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
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  // notes
                </span>
                <div className="rounded-xl border border-border bg-secondary/35 p-4 text-[13px] leading-relaxed text-foreground shadow-sm">
                  <pre className="whitespace-pre-wrap font-sans font-medium">{String(proposal.note)}</pre>
                </div>
              </div>
            ) : null}

            {proposal.terms ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  // terms_conditions
                </span>
                <div className="rounded-xl border border-border bg-secondary/35 p-4 text-[13px] leading-relaxed text-foreground shadow-sm">
                  <pre className="whitespace-pre-wrap font-sans font-medium">{String(proposal.terms)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* VERIFIED SIGNATURES */}
        {isAccepted && (
          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-[12px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              // VERIFIED.SIGNATURES
            </h3>
            {signs.length === 0 ? (
              <p className="py-2 text-[12.5px] text-muted-foreground font-mono italic px-1">
                // No signature blobs attached to accepted proposal state.
              </p>
            ) : (
              <div className="grid gap-3">
                {signs.map((s, i) => (
                  <Card key={i} className="border-success/20 bg-success/5 shadow-sm">
                    <ZoruCardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap font-mono">
                        <div>
                          <p className="text-[13px] font-bold text-foreground">
                            {String(s.signer_name || '')}
                          </p>
                          <p className="text-[11.5px] text-muted-foreground">
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
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-green-600 uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
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
                  <p className="mt-1 text-[12.5px] text-muted-foreground font-sans">
                    This proposal is approved and executed by both parties.
                  </p>
                </div>
                <div className="mt-4 w-full rounded border border-border bg-background p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                  <span className="text-muted-foreground">{"{"}</span>
                  <div className="pl-4">
                    <span className="text-blue-600">&quot;status&quot;</span>: <span className="text-green-600">&quot;accepted&quot;</span>,
                    <br />
                    <span className="text-blue-600">&quot;executed&quot;</span>: <span className="text-green-600">true</span>,
                    <br />
                    <span className="text-blue-600">&quot;code&quot;</span>: <span className="text-amber-600">200</span>
                  </div>
                  <span className="text-muted-foreground">{"}"}</span>
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
