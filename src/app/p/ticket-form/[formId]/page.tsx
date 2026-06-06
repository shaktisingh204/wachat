import React from "react";
import { loadPublicTicketForm } from '@/app/actions/worksuite/public.actions';
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
} from '@/components/sabcrm/20ui/compat';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { TicketFormRenderer } from './_form';
import { Database } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formId: string }>;
}

async function PublicTicketFormPageContent({ params }: PageProps) {
  const { formId } = await params;
  const form = await loadPublicTicketForm(formId);
  if (!form) return <InvalidLinkCard message="This form is unavailable." />;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* LEFT COLUMN: Specification & Documentation (60%) */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-[var(--st-bg-muted)] border border-[var(--st-border)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--st-text)] uppercase">
              GET
            </span>
            <span className="font-mono text-[13px] text-[var(--st-text)] tracking-tight">
              /v1/ticket-forms/{formId.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--st-text)] font-mono">
            Open a support ticket
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--st-text-secondary)] font-sans">
            Describe the technical or service issue to post it directly to our ticketing system.
          </p>
        </div>

        {/* PARAMETER SCHEMA */}
        <Card>
          <ZoruCardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text-secondary)]">
                Payload Contract Attributes
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-[var(--st-bg-muted)]/20">
                <ZoruTableRow>
                  <ZoruTableHead className="font-mono text-[11.5px]">Parameter</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px] text-right">Requirement</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">name</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant="danger">REQUIRED</Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">email</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant="danger">REQUIRED</Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">subject</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant="danger">REQUIRED</Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">description</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Badge variant="danger">REQUIRED</Badge>
                  </ZoruTableCell>
                </ZoruTableRow>
                {form.fields.map((f: any) => (
                  <ZoruTableRow key={f._id}>
                    <ZoruTableCell className="font-mono text-[12.5px]">{String(f.field_name || '')}</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">{String(f.field_type || 'string')}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Badge variant={f.is_required ? 'danger' : 'outline'}>
                        {f.is_required ? 'REQUIRED' : 'OPTIONAL'}
                      </Badge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Active Request Form & JSON Runner (40%) */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-[var(--st-bg-muted)] border border-[var(--st-border)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--st-text)] uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-[var(--st-text)] tracking-tight">
              /v1/tickets/{formId.slice(0, 8)}.../submit
            </span>
          </div>

          <TicketFormRenderer formId={formId} fields={form.fields} />
        </div>
      </div>
    </div>
  );
}


export default function PublicTicketFormPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PublicTicketFormPageContent params={params} />
    </React.Suspense>
  );
}
