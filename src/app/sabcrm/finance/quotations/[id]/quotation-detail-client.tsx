'use client';

/**
 * SabCRM Finance — Quotation detail client.
 *
 * Composes the doc-surface DocDetailPage with the quotation workflow
 * (finance-rollout spec §3.1):
 *
 *   - status transitions per the crate vocabulary (send, accept,
 *     reject, expire, reopen) — validated again server-side against
 *     `SABCRM_QUOTATION_TRANSITIONS`;
 *   - Convert menu → sales order / invoice / proforma (`converted` is
 *     set by the actions, with lineage back-links from the Rust side);
 *   - Print → `window.print()` (the kit keeps only the paper region);
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document (subject / reference / FX extras included);
 *   - related-documents rail, billing/shipping address cards, SabFiles
 *     attachments and an activity feed (created / emails / WhatsApp /
 *     revisions).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  BadgeCheck,
  CalendarX2,
  FilePenLine,
  History,
  Mail,
  MessageCircle,
  Printer,
  ReceiptText,
  RotateCcw,
  Send,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type {
  CrmQuotationDoc,
  CrmQuotationStatus,
} from '@/lib/rust-client/crm-quotations';
import {
  convertSabcrmQuotationToInvoice,
  convertSabcrmQuotationToProforma,
  convertSabcrmQuotationToSalesOrder,
  transitionSabcrmQuotationStatus,
  updateSabcrmQuotationFull,
} from '@/app/actions/sabcrm-finance-quotations.actions';
import { deleteSabcrmQuotation } from '@/app/actions/sabcrm-finance.actions';
import {
  quotationAddressLines,
  type SabcrmQuotationConvertResult,
} from '@/app/actions/sabcrm-finance-quotations.actions.types';
import type {
  SabcrmPartyContact,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '../../_components/doc-surface';
import {
  QUOTATIONS_PATH,
  QUOTATION_FLOW,
  QUOTATION_STATUSES,
  partyRecordHref,
} from '../quotation-config';
import {
  buildQuotationFormConfig,
  parseExchangeRate,
  quotationToFormValues,
  readQuotationExtras,
} from '../quotation-form';
import { QuoteShareButton } from '../quote-share-button';
import { maybeRequestDiscountApproval } from '../quote-approval-submit';

/* ─── Main client ─────────────────────────────────────────────── */

export interface QuotationDetailClientProps {
  quotation: CrmQuotationDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function QuotationDetailClient({
  quotation,
  contact,
  related,
  error,
}: QuotationDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire while
  // the user is typing.
  const editSeed = React.useMemo(
    () => (quotation ? quotationToFormValues(quotation, contact) : undefined),
    [quotation, contact],
  );
  const formConfig = React.useMemo(
    () => buildQuotationFormConfig({ withIssue: false }),
    [],
  );

  if (!quotation) {
    return (
      <DocDetailPage
        backHref={QUOTATIONS_PATH}
        backLabel="Quotations"
        docNumber="Quotation"
        entitySingular="Quotation"
        statuses={QUOTATION_STATUSES}
        flow={QUOTATION_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Quotation not found.'}
      />
    );
  }

  const status = (quotation.status ?? 'draft') as CrmQuotationStatus;
  const lineTotalSum = (quotation.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const total = quotation.totals?.total || lineTotalSum;
  const subTotal = quotation.totals?.subTotal || total;
  // Σ line totals − subTotal = Σ per-line tax (exact regardless of any
  // header-level modifiers folded into totals.total).
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const transition = (next: CrmQuotationStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmQuotationStatus(quotation._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const runConvert = (
    label: string,
    action: (id: string) => Promise<ActionResult<SabcrmQuotationConvertResult>>,
  ): void => {
    startTransition(async () => {
      const res = await action(quotation._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} ${res.data.number} created.`);
      router.push(res.data.href);
      router.refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmQuotation(quotation._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${quotation.quotationNo} deleted.`);
      router.push(QUOTATIONS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const canConvert =
    status === 'draft' || status === 'sent' || status === 'accepted';
  const canEdit = status !== 'converted';

  const convertItems: ConvertMenuItem[] = [
    {
      key: 'to-sales-order',
      label: 'Convert to sales order',
      description: 'Copies items and links this quotation',
      icon: ShoppingCart,
      onSelect: () =>
        runConvert('Sales order', convertSabcrmQuotationToSalesOrder),
    },
    {
      key: 'to-invoice',
      label: 'Convert to invoice',
      description: 'Bills the customer for these items',
      icon: ReceiptText,
      onSelect: () => runConvert('Invoice', convertSabcrmQuotationToInvoice),
    },
    {
      key: 'to-proforma',
      label: 'Convert to proforma',
      description: 'Pre-invoice ask before the tax invoice',
      icon: ArrowRightLeft,
      onSelect: () =>
        runConvert('Proforma', convertSabcrmQuotationToProforma),
    },
  ];

  const moreItems: ConvertMenuItem[] = [];
  if (status === 'sent') {
    moreItems.push(
      {
        key: 'reject',
        label: 'Mark as rejected',
        icon: XCircle,
        onSelect: () =>
          transition('rejected', `${quotation.quotationNo} marked rejected.`),
      },
      {
        key: 'expire',
        label: 'Mark as expired',
        icon: CalendarX2,
        onSelect: () =>
          transition('expired', `${quotation.quotationNo} marked expired.`),
      },
    );
  }
  if (status === 'rejected') {
    moreItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      onSelect: () =>
        transition('draft', `${quotation.quotationNo} reopened as draft.`),
    });
  }
  if (status === 'expired') {
    moreItems.push({
      key: 'resend',
      label: 'Mark as sent again',
      icon: Send,
      onSelect: () =>
        transition('sent', `${quotation.quotationNo} marked sent.`),
    });
  }
  moreItems.push({
    key: 'delete',
    label: 'Delete quotation',
    icon: Trash2,
    danger: true,
    group: moreItems.length > 0,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'draft' ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={transitioning}
          onClick={() =>
            transition('sent', `${quotation.quotationNo} marked sent.`)
          }
        >
          Mark as sent
        </Button>
      ) : null}
      {status === 'sent' ? (
        <Button
          variant="primary"
          iconLeft={BadgeCheck}
          loading={transitioning}
          onClick={() =>
            transition('accepted', `${quotation.quotationNo} accepted.`)
          }
        >
          Mark accepted
        </Button>
      ) : null}
      {canConvert ? (
        <ConvertMenu
          label="Convert"
          heading="Create from this quotation"
          items={convertItems}
          disabled={transitioning}
        />
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {status !== 'draft' && status !== 'converted' ? (
        <QuoteShareButton
          quoteId={quotation._id}
          quotationNo={quotation.quotationNo}
          disabled={transitioning}
        />
      ) : null}
      {canEdit ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="More" items={moreItems} disabled={transitioning} />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = (quotation.items ?? []).map((item) => ({
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
    total: item.total,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    ...(quotation.subject
      ? [{ label: 'Subject', value: quotation.subject }]
      : []),
    { label: 'Quotation date', value: formatDocDate(quotation.date) },
    { label: 'Valid until', value: formatDocDate(quotation.validUntil) },
    { label: 'Currency', value: quotation.currency },
    ...(quotation.exchangeRate
      ? [{ label: 'Exchange rate', value: String(quotation.exchangeRate) }]
      : []),
    ...(quotation.referenceNo
      ? [{ label: 'Reference no.', value: quotation.referenceNo }]
      : []),
    ...(quotation.placeOfSupply
      ? [{ label: 'Place of supply', value: quotation.placeOfSupply }]
      : []),
  ];

  /* ---- rail extras: stored addresses ---- */
  const billingLines = quotationAddressLines(quotation.billingAddress);
  const shippingLines = quotationAddressLines(quotation.shippingAddress);
  const railExtra =
    billingLines.length > 0 || shippingLines.length > 0 ? (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardBody>
          {billingLines.length > 0 ? (
            <div className="pb-2">
              <span className="fdoc-detail__meta-label">Billing</span>
              {billingLines.map((line, i) => (
                <span key={`b-${i}`} className="fdoc-cell-sub">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
          {shippingLines.length > 0 ? (
            <div>
              <span className="fdoc-detail__meta-label">Shipping</span>
              {shippingLines.map((line, i) => (
                <span key={`s-${i}`} className="fdoc-cell-sub">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>
    ) : null;

  /* ---- activity ---- */
  const createdAt = quotation.audit?.createdAt ?? quotation.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Quotation created',
      at: createdAt,
    });
  }
  for (const [i, log] of (quotation.emailLog ?? []).entries()) {
    activity.push({
      id: `email-${i}`,
      icon: Mail,
      title: `Emailed to ${log.to}`,
      meta: log.status,
      at: log.sentAt,
    });
  }
  for (const [i, log] of (quotation.whatsappSendLog ?? []).entries()) {
    activity.push({
      id: `wa-${i}`,
      icon: MessageCircle,
      title: `Sent on WhatsApp to ${log.to}`,
      meta: log.status,
      at: log.sentAt,
    });
  }
  for (const [i, rev] of (quotation.revisionHistory ?? []).entries()) {
    activity.push({
      id: `rev-${i}`,
      icon: History,
      title: `Revision ${i + 1}${rev.note ? ` — ${rev.note}` : ''}`,
      at: rev.revisedAt,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={QUOTATIONS_PATH}
        backLabel="Quotations"
        docNumber={quotation.quotationNo}
        entitySingular="Quotation"
        statuses={QUOTATION_STATUSES}
        flow={QUOTATION_FLOW}
        status={status}
        actions={actions}
        party={
          contact
            ? {
                label: contact.label,
                href: partyRecordHref(contact.objectSlug, contact.id),
                meta: contact.email,
                addressLines: contact.addressLines,
              }
            : null
        }
        meta={meta}
        currency={quotation.currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: quotation.totals?.discountOverall,
          shippingCharge: quotation.totals?.shippingCharge,
          adjustment: quotation.totals?.adjustment,
          roundOff: quotation.totals?.roundOff,
          total,
        }}
        notes={quotation.customerNotes}
        terms={quotation.termsAndConditions}
        related={related}
        attachments={quotation.attachments}
        activity={activity}
        railExtra={railExtra}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={formConfig}
        onSubmit={async (values) => {
          const extras = readQuotationExtras(values);
          const res = await updateSabcrmQuotationFull(quotation._id, {
            quotationNo: values.number,
            clientId: values.partyId ?? undefined,
            currency: values.currency,
            date: values.date,
            validUntil: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            subject: extras.subject,
            referenceNo: extras.referenceNo,
            exchangeRate: parseExchangeRate(extras.exchangeRate),
            placeOfSupply: values.placeOfSupply ?? '',
            customerNotes: values.customerNotes,
            termsAndConditions: values.termsAndConditions,
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.quotationNo} updated.`);
          void maybeRequestDiscountApproval({
            lines: values.lines,
            quoteRef: res.data.quotationNo,
            targetRecordId: quotation._id,
          });
          refresh();
          return { ok: true };
        }}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!next && !deleting) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {quotation.quotationNo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the quotation from this workspace. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete quotation
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
