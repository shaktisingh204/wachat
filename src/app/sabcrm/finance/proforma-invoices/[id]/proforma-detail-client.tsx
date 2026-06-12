'use client';

/**
 * SabCRM Finance — Proforma detail client.
 *
 * Composes the doc-surface DocDetailPage with the proforma workflow
 * (finance-rollout spec §3.3 — legacy mounted shape, TitleCase
 * statuses):
 *
 *   - status transitions (Issue, Cancel, Reopen) validated again
 *     server-side against `SABCRM_PROFORMA_TRANSITIONS`;
 *   - Convert → invoice (`fromKind: 'proforma'` on the invoice side,
 *     then this proforma flips to `Converted`);
 *   - advance-ask card (G3 fields) + linked sales order in the rail;
 *   - Print → `window.print()`;
 *   - Edit → the shared DocForm drawer, seeded from the document.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FilePenLine,
  HandCoins,
  Printer,
  ReceiptText,
  RotateCcw,
  Send,
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
  CrmProformaInvoiceDoc,
  CrmProformaStatus,
} from '@/lib/rust-client/crm-proforma-invoices';
import {
  convertSabcrmProformaToInvoice,
  transitionSabcrmProformaStatus,
  updateSabcrmProformaFull,
} from '@/app/actions/sabcrm-finance-proforma.actions';
import { deleteSabcrmProformaInvoice } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPartyContact,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '../../_components/doc-surface';
import {
  PROFORMA_FLOW,
  PROFORMA_PATH,
  PROFORMA_STATUSES,
  partyRecordHref,
} from '../proforma-config';
import {
  buildProformaFormConfig,
  parseOptionalNumber,
  proformaToFormValues,
  readProformaExtras,
} from '../proforma-form';

/* ─── Main client ─────────────────────────────────────────────── */

export interface ProformaDetailClientProps {
  proforma: CrmProformaInvoiceDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function ProformaDetailClient({
  proforma,
  contact,
  related,
  error,
}: ProformaDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const linkedSoLabel = React.useMemo(() => {
    const parent = related.find(
      (r) => r.kind === 'salesOrder' && r.direction === 'parent',
    );
    return parent?.label ?? null;
  }, [related]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire while
  // the user is typing.
  const editSeed = React.useMemo(
    () =>
      proforma ? proformaToFormValues(proforma, contact, linkedSoLabel) : undefined,
    [proforma, contact, linkedSoLabel],
  );
  const formConfig = React.useMemo(
    () => buildProformaFormConfig({ withIssue: false }),
    [],
  );

  if (!proforma) {
    return (
      <DocDetailPage
        backHref={PROFORMA_PATH}
        backLabel="Proforma invoices"
        docNumber="Proforma invoice"
        entitySingular="Proforma invoice"
        statuses={PROFORMA_STATUSES}
        flow={PROFORMA_FLOW}
        status="Draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Proforma invoice not found.'}
      />
    );
  }

  const status = (proforma.status ?? 'Draft') as CrmProformaStatus;
  const currency = proforma.currency || 'INR';
  const total = proforma.total ?? 0;
  const subTotal = proforma.subtotal ?? total;

  const transition = (next: CrmProformaStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmProformaStatus(proforma._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const convertToInvoice = (): void => {
    startTransition(async () => {
      const res = await convertSabcrmProformaToInvoice(proforma._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invoice ${res.data.number} created.`);
      router.push(res.data.href);
      router.refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmProformaInvoice(proforma._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${proforma.proformaNumber} archived.`);
      router.push(PROFORMA_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const canConvert = status === 'Draft' || status === 'Issued';
  const canEdit = status === 'Draft' || status === 'Issued';

  const convertItems: ConvertMenuItem[] = [
    {
      key: 'to-invoice',
      label: 'Convert to invoice',
      description: 'Creates the tax invoice and marks this converted',
      icon: ReceiptText,
      onSelect: convertToInvoice,
    },
  ];

  const moreItems: ConvertMenuItem[] = [];
  if (status === 'Cancelled') {
    moreItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      onSelect: () =>
        transition('Draft', `${proforma.proformaNumber} reopened as draft.`),
    });
  }
  if (status === 'Draft' || status === 'Issued') {
    moreItems.push({
      key: 'cancel',
      label: 'Cancel proforma',
      icon: XCircle,
      danger: true,
      onSelect: () =>
        transition('Cancelled', `${proforma.proformaNumber} cancelled.`),
    });
  }
  moreItems.push({
    key: 'delete',
    label: 'Archive proforma',
    icon: Trash2,
    danger: true,
    group: true,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'Draft' ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={transitioning}
          onClick={() =>
            transition('Issued', `${proforma.proformaNumber} issued.`)
          }
        >
          Issue proforma
        </Button>
      ) : null}
      {canConvert ? (
        <ConvertMenu
          label="Convert"
          heading="Create from this proforma"
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

  /* ---- paper data (legacy line shape → kit display lines) ---- */
  const lines: DocDetailLine[] = (proforma.lineItems ?? []).map((item) => ({
    description: item.description ?? '',
    qty: item.quantity,
    unit: item.unit,
    rate: item.rate,
    taxRatePct: item.taxPct,
    total: item.amount ?? item.quantity * item.rate,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Proforma date', value: formatDocDate(proforma.proformaDate) },
    ...(proforma.validTillDate
      ? [{ label: 'Valid till', value: formatDocDate(proforma.validTillDate) }]
      : []),
    { label: 'Currency', value: currency },
    ...(proforma.paymentDueDate
      ? [
          {
            label: 'Advance due',
            value: formatDocDate(proforma.paymentDueDate),
          },
        ]
      : []),
    ...(proforma.expectedDelivery
      ? [
          {
            label: 'Expected delivery',
            value: formatDocDate(proforma.expectedDelivery),
          },
        ]
      : []),
  ];

  /* ---- rail extras: advance ask (G3) ---- */
  const hasAdvance =
    proforma.advancePct !== undefined || proforma.advanceAmount !== undefined;
  const railExtra = hasAdvance ? (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <HandCoins size={14} aria-hidden="true" /> Advance ask
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {proforma.advanceAmount !== undefined ? (
          <span className="text-sm font-medium">
            {formatDocMoney(proforma.advanceAmount, currency)}
          </span>
        ) : null}
        {proforma.advancePct !== undefined ? (
          <span className="fdoc-cell-sub">
            {proforma.advancePct}% of the proforma total
          </span>
        ) : null}
      </CardBody>
    </Card>
  ) : null;

  /* ---- activity ---- */
  const activity: DocActivityEntry[] = [];
  if (proforma.createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Proforma created',
      at: proforma.createdAt,
    });
  }
  if (status === 'Converted') {
    activity.push({
      id: 'converted',
      icon: ReceiptText,
      title: 'Converted to invoice',
      at: proforma.updatedAt,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={PROFORMA_PATH}
        backLabel="Proforma invoices"
        docNumber={proforma.proformaNumber}
        entitySingular="Proforma invoice"
        statuses={PROFORMA_STATUSES}
        flow={PROFORMA_FLOW}
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
        currency={currency}
        lines={lines}
        totals={{
          // Legacy convention: `subtotal` is gross (Σ qty × rate),
          // `total = subtotal + taxTotal − discountTotal`.
          subTotal,
          discountTotal: proforma.discountTotal || undefined,
          taxTotal: proforma.taxTotal,
          total,
        }}
        notes={proforma.notes}
        terms={(proforma.termsAndConditions ?? []).join('\n') || undefined}
        related={related}
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
          if (values.attachments.length > 0) {
            return {
              ok: false,
              error:
                "Proforma invoices don't store attachments yet — remove them to save.",
            };
          }
          const extras = readProformaExtras(values);
          const res = await updateSabcrmProformaFull(proforma._id, {
            proformaNumber: values.number,
            accountId: values.partyId ?? undefined,
            currency: values.currency,
            proformaDate: values.date,
            validTillDate: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            termsAndConditions: values.termsAndConditions,
            notes: values.customerNotes,
            linkedSoId: extras.linkedSoId || undefined,
            advancePct: parseOptionalNumber(extras.advancePct),
            advanceAmount: parseOptionalNumber(extras.advanceAmount),
            paymentDueDate: extras.paymentDueDate || undefined,
            expectedDelivery: extras.expectedDelivery || undefined,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.proformaNumber} updated.`);
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
              Archive {proforma.proformaNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived proforma invoices are hidden from the list (crm-common
              soft delete). You can restore them from the database if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Archive proforma
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
