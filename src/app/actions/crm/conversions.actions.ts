'use server';

/**
 * CRM Conversions server actions.
 *
 * ## Why these are shims, not first-class CRUD
 *
 * The Rust `crm-conversions` crate is a pure-function transformation
 * library (no HTTP, no Mongo). The supported conversions are
 * physically executed by the **child-entity create handlers** when
 * they receive `fromKind` + `fromId` on the create payload. See
 * `src/lib/rust-client/crm-conversions.ts` for the full catalog.
 *
 * This file therefore exposes:
 *
 * 1. `listSupportedConversions()` / `listConversionsFromAction()` —
 *    catalog readers for UI surfaces ("Convert this quotation to…").
 * 2. `buildConversionHrefAction()` — server-side href builder that
 *    matches the prefill contract expected by the child create pages.
 * 3. Typed `convertXxxToYyy()` helpers — thin shims over the child
 *    entity Rust clients that pre-fill `fromKind` / `fromId`. Callers
 *    still pass the full child create input (numbering, dates, totals
 *    are entity-specific decisions the UI must make).
 *
 * NB: there is no `saveConversionAction` / `deleteConversionAction`
 * because there is no Conversion record entity to save or delete.
 */

import { RustApiError } from '@/lib/rust-client';
import {
  CRM_CONVERSION_CATALOG,
  buildConversionHref,
  findConversionEdge,
  listConversionsFrom,
  listConversionsTo,
  type CrmConversionEdge,
  type CrmConversionKind,
} from '@/lib/rust-client/crm-conversions';

import {
  crmSalesOrdersApi,
  type CrmSalesOrderCreateInput,
  type CrmSalesOrderDoc,
} from '@/lib/rust-client/crm-sales-orders';
import {
  crmInvoicesApi,
  type CrmInvoiceCreateInput,
  type CrmInvoiceDoc,
} from '@/lib/rust-client/crm-invoices';
import {
  crmCreditNotesApi,
  type CrmCreditNoteCreateInput,
  type CrmCreditNoteDoc,
} from '@/lib/rust-client/crm-credit-notes';
import {
  crmBillsApi,
  type CrmBillCreateInput,
  type CrmBillDoc,
} from '@/lib/rust-client/crm-bills';
import {
  crmDebitNotesApi,
  type CrmDebitNoteCreateInput,
  type CrmDebitNoteDoc,
} from '@/lib/rust-client/crm-debit-notes';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

type ActionResult<T> = { data?: T; error?: string };

/* ─── Catalog readers ────────────────────────────────────────── */

/**
 * Return the full conversion catalog — sales + purchases.
 * Marked async because `'use server'` only allows async exports.
 */
export async function listSupportedConversions(): Promise<readonly CrmConversionEdge[]> {
  return CRM_CONVERSION_CATALOG;
}

/**
 * Conversions available *from* a parent entity kind, e.g.
 * `listConversionsFromAction('quotation')` returns the three
 * quotation→… edges.
 */
export async function listConversionsFromAction(
  fromKind: string,
): Promise<readonly CrmConversionEdge[]> {
  return listConversionsFrom(fromKind);
}

/**
 * Conversions that produce a given child entity kind.
 */
export async function listConversionsToAction(
  toKind: string,
): Promise<readonly CrmConversionEdge[]> {
  return listConversionsTo(toKind);
}

/**
 * Build the prefilled href for a conversion (parent kind + parent id
 * + supported `fromKind` / `toKind`). Returns an error string if the
 * pair is not a supported conversion.
 */
export async function buildConversionHrefAction(input: {
  fromKind: string;
  toKind: string;
  fromId: string;
}): Promise<ActionResult<{ href: string; edge: CrmConversionEdge }>> {
  const edge = findConversionEdge(input.fromKind, input.toKind);
  if (!edge) {
    return {
      error: `Unsupported conversion: ${input.fromKind} → ${input.toKind}.`,
    };
  }
  if (!input.fromId) return { error: 'Missing parent id.' };
  return { data: { href: buildConversionHref(edge, input.fromId), edge } };
}

/* ─── Typed conversion helpers ───────────────────────────────── */
//
// These wrap the child-entity Rust clients with the `fromKind` /
// `fromId` link pre-filled. The Rust child handler invokes the
// matching `crm-conversions` helper, persists the row, and stamps
// the parent's `linked*Ids[]` array. Callers still own *what* to
// send (numbering, dates, line items) because conversion is not
// always a verbatim copy — partial invoicing / split shipments are
// legitimate workflows.

/** Quotation → Sales Order. Pass a full SO create input. */
export async function convertQuotationToSalesOrder(
  quotationId: string,
  input: Omit<CrmSalesOrderCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmSalesOrderDoc>> {
  if (!quotationId) return { error: 'Missing quotation id.' };
  try {
    const data = await crmSalesOrdersApi.create({
      ...input,
      fromKind: 'quotation',
      fromId: quotationId,
      quotationRef: quotationId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** Quotation → Invoice (skip the SO step). */
export async function convertQuotationToInvoice(
  quotationId: string,
  input: Omit<CrmInvoiceCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmInvoiceDoc>> {
  if (!quotationId) return { error: 'Missing quotation id.' };
  try {
    const data = await crmInvoicesApi.create({
      ...input,
      fromKind: 'quotation',
      fromId: quotationId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** Sales Order → Invoice. */
export async function convertSalesOrderToInvoice(
  salesOrderId: string,
  input: Omit<CrmInvoiceCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmInvoiceDoc>> {
  if (!salesOrderId) return { error: 'Missing sales order id.' };
  try {
    const data = await crmInvoicesApi.create({
      ...input,
      fromKind: 'salesOrder',
      fromId: salesOrderId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** Invoice → Credit Note (return / refund / write-off). */
export async function convertInvoiceToCreditNote(
  invoiceId: string,
  input: Omit<CrmCreditNoteCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmCreditNoteDoc>> {
  if (!invoiceId) return { error: 'Missing invoice id.' };
  try {
    const data = await crmCreditNotesApi.create({
      ...input,
      fromKind: 'invoice',
      fromId: invoiceId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** Purchase Order → Bill. */
export async function convertPurchaseOrderToBill(
  purchaseOrderId: string,
  input: Omit<CrmBillCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmBillDoc>> {
  if (!purchaseOrderId) return { error: 'Missing purchase order id.' };
  try {
    const data = await crmBillsApi.create({
      ...input,
      fromKind: 'purchaseOrder',
      fromId: purchaseOrderId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** GRN → Bill. */
export async function convertGrnToBill(
  grnId: string,
  input: Omit<CrmBillCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmBillDoc>> {
  if (!grnId) return { error: 'Missing GRN id.' };
  try {
    const data = await crmBillsApi.create({
      ...input,
      fromKind: 'grn',
      fromId: grnId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/** Bill → Debit Note. */
export async function convertBillToDebitNote(
  billId: string,
  input: Omit<CrmDebitNoteCreateInput, 'fromKind' | 'fromId'>,
): Promise<ActionResult<CrmDebitNoteDoc>> {
  if (!billId) return { error: 'Missing bill id.' };
  try {
    const data = await crmDebitNotesApi.create({
      ...input,
      fromKind: 'bill',
      fromId: billId,
    });
    return { data };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/* ─── Re-exports for callers ─────────────────────────────────── */
//
// 'use server' files cannot re-export non-async values directly, so
// expose async getters for typed catalog access from clients that
// only know `import * from .../conversions.actions`.

export async function getConversionKinds(): Promise<readonly CrmConversionKind[]> {
  return CRM_CONVERSION_CATALOG.map((e) => e.kind);
}
