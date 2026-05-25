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
import { fmtCurrency } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ContractSignForm } from './_form';
import { FileText, Database, ShieldCheck, Fingerprint } from 'lucide-react';
import type { ContractDetails, ContractSign } from './types';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function isoDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium' }).format(d);
}

function isoDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function generateAuditHash(data: string) {
  try {
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return 'unavailable';
  }
}

interface PageProps {
  params: Promise<{ token: string }>;
}

function ContractHeader({ token, contract }: { token: string; contract: ContractDetails }) {
  return (
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
        {contract.subject || contract.name || 'Contract Specification'}
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Below is the formal terms specification for contract registration.
      </p>
    </div>
  );
}

function ContractAttributes({ contract, isSigned }: { contract: ContractDetails; isSigned: boolean }) {
  return (
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
              <ZoruTableCell className="text-right text-[12.5px] font-medium">{isoDate(contract.start_date)}</ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">end_date</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
              <ZoruTableCell className="text-right text-[12.5px] font-medium">{isoDate(contract.end_date)}</ZoruTableCell>
            </ZoruTableRow>
            {contract.value ? (
              <ZoruTableRow>
                <ZoruTableCell className="font-mono text-[12.5px]">contract_value</ZoruTableCell>
                <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] font-bold text-foreground">
                  {fmtCurrency(Number(contract.value), contract.currency || 'INR')}
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
  );
}

function ContractTerms({ contract }: { contract: ContractDetails }) {
  if (!contract.description) return null;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground px-1">
        <FileText className="h-4 w-4" />
        <span>Contractual Terms (Description)</span>
      </div>
      <div className="rounded-xl border border-border bg-secondary/35 p-5 text-[13px] leading-relaxed text-foreground shadow-sm">
        <pre className="whitespace-pre-wrap font-sans font-medium">
          {contract.description}
        </pre>
      </div>
    </div>
  );
}

function SignatureLogs({ signs }: { signs: ContractSign[] }) {
  if (signs.length === 0) return null;
  
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-[12px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" />
        // SIGNATURE.LOGS & AUDIT TRAIL
      </h3>
      <div className="grid gap-3">
        {signs.map((s, i) => (
          <Card key={i} className="border-success/20 bg-success/5 shadow-sm overflow-hidden">
            <ZoruCardContent className="p-0">
              <div className="p-4 flex items-start justify-between gap-3 flex-wrap border-b border-success/10">
                <div>
                  <p className="text-[13px] font-bold text-foreground font-mono">
                    {s.signer_name}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground font-mono">
                    {s.signer_email}
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-success/10 border border-success/20 px-2 py-0.5 rounded text-success-ink uppercase">
                  Verified {isoDateTime(s.signed_at)}
                </span>
              </div>
              <div className="bg-success/10 px-4 py-2 flex items-center gap-2">
                <Fingerprint className="h-3.5 w-3.5 text-success-ink/70" />
                <span className="text-[10px] font-mono text-success-ink/80 truncate w-full" title={generateAuditHash(s.signature_data_url)}>
                  SHA-256: {generateAuditHash(s.signature_data_url)}
                </span>
              </div>
            </ZoruCardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ContractExecutionStatus({ signsCount }: { signsCount: number }) {
  return (
    <Card className="border-success/20 bg-success/5 mb-5">
      <ZoruCardContent className="py-6 text-center flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
          200
        </div>
        <div>
          <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
            // EXECUTION.SUCCESSFUL
          </h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            This contract has been signed by {signsCount} part{signsCount === 1 ? 'y' : 'ies'}.
          </p>
        </div>
        <div className="mt-2 w-full rounded border border-border bg-background p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
          <span className="text-muted-foreground">{"{"}</span>
          <div className="pl-4">
            <span className="text-blue-600">&quot;status&quot;</span>: <span className="text-green-600">&quot;signed&quot;</span>,
            <br />
            <span className="text-blue-600">&quot;code&quot;</span>: <span className="text-amber-600">200</span>,
            <br />
            <span className="text-blue-600">&quot;parties_signed&quot;</span>: <span className="text-amber-600">{signsCount}</span>
          </div>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

export default async function PublicContractPage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  
  if (!result || result.resource.type !== 'contract') {
    return <InvalidLinkCard />;
  }
  
  const contract = result.resource.contract as ContractDetails;
  const signs = result.resource.signs as ContractSign[];
  const isSigned = !!contract.signed || signs.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <ContractHeader token={token} contract={contract} />
        <ContractAttributes contract={contract} isSigned={isSigned} />
        <ContractTerms contract={contract} />
        <SignatureLogs signs={signs} />
      </div>

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

          {isSigned && <ContractExecutionStatus signsCount={signs.length} />}
          
          <div className="opacity-90 hover:opacity-100 transition-opacity">
            <ContractSignForm token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
