'use client';

/**
 * doc-surface — DocDetailPage.
 *
 * The document detail layout every finance entity adopts:
 *
 *   - header: back link, doc number, StatusFlow rail, actions-bar slot
 *     (status transitions, ConvertMenu, Email, Print, Edit, …);
 *   - main column: the print-friendly "paper" (party, dates, line-items
 *     table, totals, notes/terms) — the ONLY region `@media print`
 *     keeps, so ⌘P from anywhere yields a clean document;
 *   - rail: party card (links to the CRM record), payment summary,
 *     related-documents (lineage parents + children), attachments and
 *     an activity feed slot.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Paperclip,
  UserRound,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui';

import { StatusFlow } from './status-flow';
import { formatDocDate, formatDocMoney } from './doc-list-page';
import type {
  DocActivityEntry,
  DocDetailLine,
  DocRelatedRef,
  DocStatusDef,
} from './types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './doc-surface.css';

export interface DocDetailParty {
  label: string;
  /** Route to the CRM record (null when the record is gone). */
  href: string | null;
  meta?: string | null;
  /**
   * Bill-to address lines resolved from the linked CRM record's
   * ADDRESS field (street / street 2 / city-state-postcode / country).
   * Rendered on the paper under "Billed to" and on the party card.
   */
  addressLines?: string[];
}

export interface DocDetailTotals {
  subTotal: number;
  discountTotal?: number;
  taxTotal?: number;
  /** Header-level modifiers (rows render only when non-zero). */
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
  amountPaid?: number;
  balance?: number;
}

export interface DocDetailPageProps {
  backHref: string;
  backLabel: string;
  /** Document identity. */
  docNumber: string;
  entitySingular: string;
  /** Status rail. */
  statuses: DocStatusDef[];
  flow: string[];
  status: string;
  /** Actions-bar slot (right side of the header). */
  actions?: React.ReactNode;
  /** Paper content. */
  party: DocDetailParty | null;
  meta: { label: string; value: React.ReactNode }[];
  currency: string;
  lines: DocDetailLine[];
  totals: DocDetailTotals;
  notes?: string | null;
  terms?: string | null;
  /** Rail content. */
  related: DocRelatedRef[];
  attachments?: { fileId: string; name?: string }[];
  activity?: DocActivityEntry[];
  /** Extra rail cards (entity-specific). */
  railExtra?: React.ReactNode;
  /** Non-null when the doc failed to load — renders the error alone. */
  error?: string | null;
}

const hasTax = (lines: DocDetailLine[]): boolean =>
  lines.some((l) => (l.taxRatePct ?? 0) > 0);
const hasDiscount = (lines: DocDetailLine[]): boolean =>
  lines.some((l) => (l.discountPct ?? 0) > 0);

export function DocDetailPage({
  backHref,
  backLabel,
  docNumber,
  entitySingular,
  statuses,
  flow,
  status,
  actions,
  party,
  meta,
  currency,
  lines,
  totals,
  notes,
  terms,
  related,
  attachments,
  activity,
  railExtra,
  error,
}: DocDetailPageProps): React.JSX.Element {
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> {backLabel}
        </Link>
        <div className="mt-6">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load this {entitySingular.toLowerCase()}: {error}
          </Alert>
        </div>
      </div>
    );
  }

  const showTax = hasTax(lines);
  const showDiscount = hasDiscount(lines);
  const parents = related.filter((r) => r.direction === 'parent');
  const children = related.filter((r) => r.direction === 'child');

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> {backLabel}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
            {docNumber}
          </h1>
          <div className="mt-2">
            <StatusFlow flow={flow} statuses={statuses} current={status} />
          </div>
        </div>
        {actions ? (
          <div
            className="flex flex-wrap items-center gap-2"
            role="toolbar"
            aria-label={`${entitySingular} actions`}
          >
            {actions}
          </div>
        ) : null}
      </div>

      <div className="fdoc-detail">
        {/* ─── Paper (the print region) ─────────────────────────── */}
        <section className="fdoc-paper" aria-label={`${entitySingular} ${docNumber}`}>
          <div className="fdoc-paper__head">
            <div>
              <h2 className="fdoc-paper__title">{docNumber}</h2>
              <span className="fdoc-cell-sub">{entitySingular}</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Billed to</span>
              <span className="fdoc-detail__meta-value">
                {party ? (
                  party.href ? (
                    <Link href={party.href} data-noprint-link="">
                      {party.label}
                    </Link>
                  ) : (
                    party.label
                  )
                ) : (
                  <span className="fdoc-unknown-party">Unknown customer</span>
                )}
              </span>
              {party?.meta ? (
                <span className="fdoc-cell-sub">{party.meta}</span>
              ) : null}
              {party?.addressLines?.length ? (
                <span className="fdoc-paper__addr">
                  {party.addressLines.map((line, i) => (
                    <span key={i} className="fdoc-cell-sub">
                      {line}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>

          <div className="fdoc-detail__meta">
            {meta.map((m) => (
              <div key={m.label}>
                <span className="fdoc-detail__meta-label">{m.label}</span>
                <span className="fdoc-detail__meta-value">{m.value}</span>
              </div>
            ))}
          </div>

          <table className="fdoc-paper-lines">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="is-num">Qty</th>
                <th scope="col" className="is-num">Rate</th>
                {showDiscount ? (
                  <th scope="col" className="is-num">Disc %</th>
                ) : null}
                {showTax ? (
                  <th scope="col" className="is-num">Tax %</th>
                ) : null}
                <th scope="col" className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    {line.description || line.itemLabel || '—'}
                    {line.itemLabel && line.description &&
                    line.itemLabel !== line.description ? (
                      <span className="fdoc-cell-sub">{line.itemLabel}</span>
                    ) : null}
                    {line.hsnSac ? (
                      <span className="fdoc-cell-sub">HSN/SAC {line.hsnSac}</span>
                    ) : null}
                  </td>
                  <td className="is-num">
                    {line.qty}
                    {line.unit ? ` ${line.unit}` : ''}
                  </td>
                  <td className="is-num">{formatDocMoney(line.rate, currency)}</td>
                  {showDiscount ? (
                    <td className="is-num">
                      {line.discountPct ? `${line.discountPct}%` : '—'}
                    </td>
                  ) : null}
                  {showTax ? (
                    <td className="is-num">
                      {line.taxRatePct ? `${line.taxRatePct}%` : '—'}
                    </td>
                  ) : null}
                  <td className="is-num">{formatDocMoney(line.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fdoc-lines__footer" data-section="totals">
            <div />
            <dl className="fdoc-totals">
              <dt className="fdoc-totals__label">Subtotal</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(totals.subTotal, currency)}
              </dd>
              {totals.discountTotal ? (
                <>
                  <dt className="fdoc-totals__label">Line discounts</dt>
                  <dd className="fdoc-totals__value">
                    −{formatDocMoney(totals.discountTotal, currency)}
                  </dd>
                </>
              ) : null}
              {totals.taxTotal !== undefined && (showTax || totals.taxTotal > 0) ? (
                <>
                  <dt className="fdoc-totals__label">Tax</dt>
                  <dd className="fdoc-totals__value">
                    {formatDocMoney(totals.taxTotal, currency)}
                  </dd>
                </>
              ) : null}
              {totals.discountOverall ? (
                <>
                  <dt className="fdoc-totals__label">Discount</dt>
                  <dd className="fdoc-totals__value">
                    −{formatDocMoney(totals.discountOverall, currency)}
                  </dd>
                </>
              ) : null}
              {totals.shippingCharge ? (
                <>
                  <dt className="fdoc-totals__label">Shipping</dt>
                  <dd className="fdoc-totals__value">
                    {formatDocMoney(totals.shippingCharge, currency)}
                  </dd>
                </>
              ) : null}
              {totals.adjustment ? (
                <>
                  <dt className="fdoc-totals__label">Adjustment</dt>
                  <dd className="fdoc-totals__value">
                    {totals.adjustment < 0 ? '−' : ''}
                    {formatDocMoney(Math.abs(totals.adjustment), currency)}
                  </dd>
                </>
              ) : null}
              {totals.roundOff ? (
                <>
                  <dt className="fdoc-totals__label">Round off</dt>
                  <dd className="fdoc-totals__value">
                    {totals.roundOff < 0 ? '−' : '+'}
                    {formatDocMoney(Math.abs(totals.roundOff), currency)}
                  </dd>
                </>
              ) : null}
              <div className="fdoc-totals__grand">
                <dt className="fdoc-totals__label">Total</dt>
                <dd className="fdoc-totals__value">
                  {formatDocMoney(totals.total, currency)}
                </dd>
              </div>
              {totals.amountPaid !== undefined && totals.amountPaid > 0 ? (
                <>
                  <dt className="fdoc-totals__label">Paid</dt>
                  <dd className="fdoc-totals__value">
                    −{formatDocMoney(totals.amountPaid, currency)}
                  </dd>
                  <div className="fdoc-totals__grand">
                    <dt className="fdoc-totals__label">Balance due</dt>
                    <dd className="fdoc-totals__value">
                      {formatDocMoney(totals.balance ?? totals.total - totals.amountPaid, currency)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </div>

          {notes ? (
            <div className="fdoc-paper__notes">
              <h4>Notes</h4>
              {notes}
            </div>
          ) : null}
          {terms ? (
            <div className="fdoc-paper__notes">
              <h4>Terms &amp; conditions</h4>
              {terms}
            </div>
          ) : null}
        </section>

        {/* ─── Rail ─────────────────────────────────────────────── */}
        <aside className="fdoc-rail" aria-label="Document context">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={14} aria-hidden="true" /> Customer
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {party ? (
                <>
                  {party.href ? (
                    <Link
                      href={party.href}
                      className="text-sm font-medium text-[var(--st-accent)] hover:underline"
                    >
                      {party.label}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{party.label}</span>
                  )}
                  {party.meta ? (
                    <span className="fdoc-cell-sub">{party.meta}</span>
                  ) : null}
                  {party.addressLines?.length ? (
                    <span className="fdoc-paper__addr">
                      {party.addressLines.map((line, i) => (
                        <span key={i} className="fdoc-cell-sub">
                          {line}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="fdoc-unknown-party text-sm">
                  Unknown customer
                </span>
              )}
            </CardBody>
          </Card>

          {railExtra}

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>Related documents</CardTitle>
            </CardHeader>
            <CardBody>
              {related.length === 0 ? (
                <span className="fdoc-cell-sub">
                  Nothing linked yet — conversions and payments appear here.
                </span>
              ) : (
                <ul className="fdoc-rail-list">
                  {[...parents, ...children].map((ref) => {
                    const Arrow =
                      ref.direction === 'parent' ? ArrowUpRight : ArrowDownLeft;
                    const inner = (
                      <>
                        <span>
                          <span className="inline-flex items-center gap-1">
                            <Arrow size={12} aria-hidden="true" />
                            {ref.label}
                          </span>
                          <span className="fdoc-rail-item__kind">
                            {ref.kind === 'paymentReceipt'
                              ? 'Payment receipt'
                              : ref.kind.replace(/([a-z])([A-Z])/g, '$1 $2')}
                            {ref.date ? ` · ${formatDocDate(ref.date)}` : ''}
                          </span>
                        </span>
                        {ref.amount !== undefined ? (
                          <span className="fdoc-rail-item__amount">
                            {formatDocMoney(ref.amount, ref.currency ?? currency)}
                          </span>
                        ) : ref.status ? (
                          <Badge tone="neutral">{ref.status}</Badge>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={`${ref.kind}-${ref.id}`}>
                        {ref.href ? (
                          <Link href={ref.href} className="fdoc-rail-item">
                            {inner}
                          </Link>
                        ) : (
                          <span className="fdoc-rail-item">{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {attachments && attachments.length > 0 ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip size={14} aria-hidden="true" /> Attachments
                  </span>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="fdoc-rail-list">
                  {attachments.map((att) => (
                    <li key={att.fileId} className="fdoc-rail-item">
                      <span>{att.name ?? 'Attachment'}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {activity ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardBody>
                {activity.length === 0 ? (
                  <span className="fdoc-cell-sub">No activity yet.</span>
                ) : (
                  <ul className="fdoc-activity">
                    {activity.map((entry) => {
                      const EntryIcon = entry.icon;
                      return (
                        <li key={entry.id} className="fdoc-activity__row">
                          {EntryIcon ? (
                            <span className="fdoc-activity__icon">
                              <EntryIcon size={12} aria-hidden="true" />
                            </span>
                          ) : null}
                          <span>
                            {entry.title}
                            {entry.meta || entry.at ? (
                              <span className="fdoc-activity__meta">
                                {[entry.meta, entry.at ? formatDocDate(entry.at) : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
