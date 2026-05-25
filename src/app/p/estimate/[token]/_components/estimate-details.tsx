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
import { FileText, Database } from 'lucide-react';

export interface Estimate {
  _id?: string;
  description?: string | null;
  notes?: string | null;
  status?: string;
  desired_date?: string | Date | null;
  requester_name?: string | null;
  [key: string]: any;
}

export interface Acceptance {
  accepted_by_name?: string | null;
  accepted_by_email?: string | null;
  accepted_at?: string | Date | null;
  [key: string]: any;
}

export function EstimateDetails({
  estimate,
  acceptances,
  accepted,
  token,
}: {
  estimate: Estimate;
  acceptances: Acceptance[];
  accepted: boolean;
  token: string;
}) {
  return (
    <div className="flex flex-col gap-6 lg:col-span-3">
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-blue-600 uppercase">
            GET
          </span>
          <span className="font-mono text-[13px] text-foreground tracking-tight">
            /v1/estimates/{token.slice(0, 8)}...
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {estimate.requester_name ||
            estimate.description?.toString().slice(0, 60) ||
            'Estimate Request'}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Below is the request specification for project estimation.
        </p>
      </div>

      {/* ATTRIBUTES TABLE */}
      <Card>
        <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
              Request Parameters
            </ZoruCardTitle>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          <Table>
            <ZoruTableHeader className="bg-secondary/20">
              <ZoruTableRow>
                <ZoruTableHead className="font-mono text-[11.5px]">Parameter</ZoruTableHead>
                <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                <ZoruTableHead className="font-mono text-[11.5px] text-right">Value</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              <ZoruTableRow>
                <ZoruTableCell className="font-mono text-[12.5px]">desired_date</ZoruTableCell>
                <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] font-medium">
                  <span suppressHydrationWarning>{fmtDate(estimate.desired_date)}</span>
                </ZoruTableCell>
              </ZoruTableRow>
              <ZoruTableRow>
                <ZoruTableCell className="font-mono text-[12.5px]">estimate_status</ZoruTableCell>
                <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">string</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Badge variant={accepted ? 'success' : 'warning'}>
                    {String(estimate.status || 'PENDING').toUpperCase()}
                  </Badge>
                </ZoruTableCell>
              </ZoruTableRow>
            </ZoruTableBody>
          </Table>
        </ZoruCardContent>
      </Card>

      {/* ESTIMATE DESCRIPTION */}
      {estimate.description ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground px-1">
            <FileText className="h-4 w-4" />
            <span>Project Requirements (Description)</span>
          </div>
          <div className="rounded-xl border border-border bg-secondary/35 p-5 text-[13px] leading-relaxed text-foreground shadow-sm">
            <pre className="whitespace-pre-wrap font-sans font-medium">
              {String(estimate.description)}
            </pre>
          </div>
        </div>
      ) : null}

      {/* NOTES */}
      {estimate.notes ? (
        <div className="rounded-xl border border-border p-4 bg-secondary/20">
          <p className="text-[12.5px] text-muted-foreground font-medium">
            <span className="font-mono text-[11px] text-foreground mr-1.5 uppercase font-bold">// Notes:</span>
            {String(estimate.notes)}
          </p>
        </div>
      ) : null}

      {/* ACCEPTANCES */}
      {accepted && acceptances.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-[12px] font-bold uppercase tracking-wider text-muted-foreground px-1">
            // ACCEPTANCE.RECORDS
          </h3>
          <div className="grid gap-3">
            {acceptances.map((a, i) => (
              <Card key={i} className="border-success/20 bg-success/5 shadow-sm">
                <ZoruCardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[13px] font-bold text-foreground font-mono">
                        {String(a.accepted_by_name || '')}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground font-mono">
                        {String(a.accepted_by_email || '')}
                      </p>
                    </div>
                    <span suppressHydrationWarning className="text-[11px] font-mono bg-success/10 border border-success/20 px-2 py-0.5 rounded text-success-ink uppercase">
                      Accepted {fmtDateTime(a.accepted_at)}
                    </span>
                  </div>
                </ZoruCardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
