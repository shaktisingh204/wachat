import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
/**
 * <ContractDetailBody> — main content cards for the contract detail page.
 * Server component. Renders: Overview · Parties · Terms & body ·
 * Signature audit trail · Notes.
 */

import * as React from 'react';

import type { HrContract } from '@/lib/hr-types';

type Contract = HrContract & {
  _id: string;
  signers?: Array<{ name?: string; email?: string }>;
  sentAt?: string | Date;
  voidedAt?: string | Date;
  voidReason?: string;
  renewedAt?: string | Date;
  notes?: string;
};

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  if (Number.isNaN(d.getTime())) return '—';
  // Use a stable formatting approach for Server Components to avoid hydration mismatch 
  // if this ever is passed to client components.
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency ?? 'INR'} ${value}`;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{value ?? '—'}</div>
    </div>
  );
}

interface ContractDetailBodyProps {
  contract: Contract;
}

import { ContractStatusTimeline } from './contract-status-timeline';

export function ContractDetailBody({ contract }: ContractDetailBodyProps) {
  return (
    <>
      <ContractStatusTimeline 
        status={contract.status || 'draft'} 
        sentAt={contract.sentAt} 
        signedAt={contract.signedAt} 
        voidedAt={contract.voidedAt} 
      />
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" value={contract.title || '—'} />
            <Field
              label="Value"
              value={fmtMoney(contract.value, contract.currency)}
            />
            <Field label="Start date" value={fmtDate(contract.startDate)} />
            <Field label="End date" value={fmtDate(contract.endDate)} />
            <Field label="Currency" value={contract.currency || 'INR'} />
            <Field
              label="Status"
              value={
                <Badge variant="outline">
                  {contract.status || 'draft'}
                </Badge>
              }
            />
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Parties</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Party A (our org)" value="—" />
            <Field
              label="Party B (counterparty)"
              value={contract.clientName || '—'}
            />
            {contract.signers && contract.signers.length > 0 ? (
              <div className="md:col-span-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                  Signers on record
                </div>
                <ul className="mt-1 space-y-1 text-[13px] text-zoru-ink">
                  {contract.signers.map((s, idx) => (
                    <li key={`${s.email}-${idx}`} className="flex gap-2">
                      <span className="text-zoru-ink-muted">{idx + 1}.</span>
                      <span>{s.name || '—'}</span>
                      <span className="text-zoru-ink-muted">{s.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ZoruCardContent>
      </Card>

      {contract.body ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Terms &amp; body</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <pre className="whitespace-pre-wrap font-sans text-[13px] text-zoru-ink">
              {contract.body}
            </pre>
          </ZoruCardContent>
        </Card>
      ) : null}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Signature audit trail</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {contract.status === 'signed' && contract.signedAt ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Signed by" value={contract.signedByName || '—'} />
              <Field label="Email" value={contract.signedByEmail || '—'} />
              <Field label="Signed at" value={fmtDateTime(contract.signedAt)} />
              {contract.signatureDataUrl ? (
                <div className="md:col-span-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Signature
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contract.signatureDataUrl}
                    alt="Signature"
                    className="mt-1 max-h-24 rounded-lg border border-zoru-line bg-white p-2"
                  />
                </div>
              ) : null}
            </div>
          ) : contract.sentAt ? (
            <p className="text-[13px] text-zoru-ink-muted">
              Sent for signature on {fmtDateTime(contract.sentAt)}. Awaiting
              signer response.
            </p>
          ) : (
            <p className="text-[13px] text-zoru-ink-muted">
              No signature events yet.
            </p>
          )}
          {contract.voidedAt ? (
            <p className="mt-3 text-[12.5px] text-zoru-danger-ink">
              Voided {fmtDateTime(contract.voidedAt)}
              {contract.voidReason ? ` — ${contract.voidReason}` : ''}
            </p>
          ) : null}
          {contract.renewedAt ? (
            <p className="mt-3 text-[12.5px] text-zoru-ink-muted">
              Last renewed {fmtDateTime(contract.renewedAt)}
            </p>
          ) : null}
        </ZoruCardContent>
      </Card>

      {contract.notes ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {contract.notes}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}
    </>
  );
}
