import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
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
import { ContractSignForm } from './_form';
import { FileText, Database } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicContractPage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'contract') {
    return <InvalidLinkCard />;
  }
  const { contract, signs } = result.resource as {
    contract: Record<string, unknown>;
    signs: Array<Record<string, unknown>>;
  };
  const isSigned = !!contract.signed || signs.length > 0;

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
              /v1/contracts/{token.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {String(contract.subject || contract.name || 'Contract Specification')}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Below is the formal terms specification for contract registration.
          </p>
        </div>

        {/* PARAMETERS TABLE (OpenAPI Parameters style) */}
        <Card>
          <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
                Document Attributes
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-secondary/20">
                <ZoruTableRow>
                  <ZoruTableHead className="font-mono text-[11.5px]">Attribute</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px] text-right">Value</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">start_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(contract.start_date)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">end_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(contract.end_date)}</ZoruTableCell>
                </ZoruTableRow>
                {contract.value ? (
                  <ZoruTableRow>
                    <ZoruTableCell className="font-mono text-[12.5px]">contract_value</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[12.5px] font-bold text-foreground">
                      {fmtCurrency(Number(contract.value), String(contract.currency || 'INR'))}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : null}
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">signature_status</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant={isSigned ? 'success' : 'warning'}>
                      {isSigned ? 'SIGNED' : 'PENDING'}
                    </Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>

        {/* CONTRACT TERMS DOCUMENT */}
        {contract.description ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground px-1">
              <FileText className="h-4 w-4" />
              <span>Contractual Terms (Description)</span>
            </div>
            <div className="rounded-xl border border-border bg-secondary/35 p-5 text-[13px] leading-relaxed text-foreground shadow-sm">
              <pre className="whitespace-pre-wrap font-sans font-medium">
                {String(contract.description)}
              </pre>
            </div>
          </div>
        ) : null}

        {/* SIGNATURE LOGS */}
        {isSigned && (
          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-[12px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              // SIGNATURE.LOGS
            </h3>
            <div className="grid gap-3">
              {signs.map((s, i) => (
                <Card key={i} className="border-success/20 bg-success/5 shadow-sm">
                  <ZoruCardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[13px] font-bold text-foreground font-mono">
                          {String(s.signer_name || '')}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground font-mono">
                          {String(s.signer_email || '')}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono bg-success/10 border border-success/20 px-2 py-0.5 rounded text-success-ink uppercase">
                        Verified {fmtDateTime(s.signed_at)}
                      </span>
                    </div>
                  </ZoruCardContent>
                </Card>
              ))}
            </div>
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
              /v1/contracts/{token.slice(0, 8)}.../sign
            </span>
          </div>

          {isSigned ? (
            <Card className="border-success/20 bg-success/5">
              <ZoruCardContent className="py-8 text-center flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
                  200
                </div>
                <div>
                  <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
                    // EXECUTION.SUCCESSFUL
                  </h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    This contract has been signed and sealed.
                  </p>
                </div>
                <div className="mt-4 w-full rounded border border-border bg-background p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                  <span className="text-muted-foreground">{"{"}</span>
                  <div className="pl-4">
                    <span className="text-blue-600">&quot;status&quot;</span>: <span className="text-green-600">&quot;signed&quot;</span>,
                    <br />
                    <span className="text-blue-600">&quot;code&quot;</span>: <span className="text-amber-600">200</span>,
                    <br />
                    <span className="text-blue-600">&quot;message&quot;</span>: <span className="text-green-600">&quot;Verified cryptographically&quot;</span>
                  </div>
                  <span className="text-muted-foreground">{"}"}</span>
                </div>
              </ZoruCardContent>
            </Card>
          ) : (
            <ContractSignForm token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
