/**
 * Authenticated detail loaders for the `/api/pdf/*` routes.
 *
 * Mirrors the public `*WithDetails` actions but enforces tenant
 * ownership via `getSession()` — the publicHash auth model doesn't
 * apply when the request comes from inside the dashboard.
 *
 * Each loader returns a result shaped exactly like the matching
 * `Public*Detail` so the same render functions can consume either.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
  PublicContractDetail,
  PublicContractDetailResult,
} from '@/app/actions/public-contract.actions.types';
import type {
  PublicEstimateDetail,
  PublicEstimateDetailResult,
} from '@/app/actions/public-estimate.actions.types';
import type {
  PublicInvoiceDetail,
  PublicInvoiceDetailResult,
} from '@/app/actions/public-invoice.actions.types';
import type {
  PublicProposalDetail,
  PublicProposalDetailResult,
} from '@/app/actions/public-proposal.actions.types';

type Unauthorized = { ok: false; error: string; status: 401 | 403 | 404 };

async function requireOwner(): Promise<
  { ok: true; userId: ObjectId } | Unauthorized
> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'Unauthorized.', status: 401 };
  try {
    return { ok: true, userId: new ObjectId(session.user._id) };
  } catch {
    return { ok: false, error: 'Invalid session.', status: 401 };
  }
}

function assertObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function loadCompany(
  db: import('mongodb').Db,
  userId: ObjectId,
): Promise<PublicInvoiceDetail['company']> {
  try {
    const settings = await db.collection('crm_settings').findOne({ userId });
    if (!settings) return {};
    return {
      name: (settings.companyName as string) || '',
      address: (settings.companyAddress as string) || '',
      email: (settings.companyEmail as string) || '',
      phone: (settings.companyPhone as string) || '',
      taxId: (settings.gstin as string) || '',
      logoUrl: (settings.companyLogo as string) || (settings.logoUrl as string) || null,
    };
  } catch {
    return {};
  }
}

async function loadAccount(
  db: import('mongodb').Db,
  accountId: ObjectId | string | undefined,
): Promise<PublicInvoiceDetail['client']> {
  if (!accountId) return {};
  try {
    const id = typeof accountId === 'string' ? new ObjectId(accountId) : accountId;
    const account = await db.collection('crm_accounts').findOne({ _id: id });
    if (!account) return {};
    return {
      name: (account.name as string) || (account.accountName as string) || '',
      email: (account.email as string) || '',
      phone: (account.phone as string) || '',
      address: (account.billingAddress as string) || (account.address as string) || '',
      taxId: (account.gstin as string) || (account.taxId as string) || '',
    };
  } catch {
    return {};
  }
}

function mapLineItems(
  lineItems: unknown,
): PublicInvoiceDetail['items'] {
  if (!Array.isArray(lineItems)) return [];
  return (lineItems as Array<Record<string, unknown>>).map((li) => ({
    name: (li.name as string) || (li.description as string) || '',
    description: (li.description as string) || '',
    hsnCode: (li.hsnCode as string) || (li.hsn as string) || '',
    quantity: Number(li.quantity ?? li.qty ?? 0),
    rate: Number(li.rate ?? li.unitPrice ?? 0),
    total: Number(
      li.total ??
        li.amount ??
        Number(li.quantity ?? li.qty ?? 0) * Number(li.rate ?? li.unitPrice ?? 0),
    ),
  }));
}

// ---------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------

export async function loadInvoiceForPdf(invoiceId: string): Promise<PublicInvoiceDetailResult | Unauthorized> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const _id = assertObjectId(invoiceId);
  if (!_id) return { ok: false, error: 'Invalid id.', status: 404 };

  const { db } = await connectToDatabase();
  const invoice = await db.collection('crm_invoices').findOne({ _id, userId: owner.userId });
  if (!invoice) return { ok: false, error: 'Not found.', status: 404 };

  const company = await loadCompany(db, owner.userId);
  const client = await loadAccount(db, invoice.accountId);
  const items = mapLineItems(invoice.lineItems);

  const payments: PublicInvoiceDetail['payments'] = [];
  try {
    const docs = await db
      .collection('crm_payments')
      .find({ invoiceId: invoice._id, status: { $ne: 'rejected' } })
      .sort({ createdAt: 1 })
      .toArray();
    for (const p of docs) {
      payments.push({
        date: p.createdAt ? new Date(p.createdAt as Date).toISOString() : null,
        amount: Number(p.amount ?? 0),
        mode: (p.gateway as string) || (p.mode as string) || 'Other',
        reference: (p.reference as string) || (p.transactionId as string) || '',
        notes: (p.notes as string) || undefined,
      });
    }
  } catch {
    /* non-fatal */
  }

  const amountPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const total = Number(invoice.total ?? 0);

  return {
    ok: true,
    invoice: {
      _id: invoice._id.toString(),
      invoiceNumber:
        (invoice.invoiceNumber as string) || (invoice.invoiceNo as string) || '',
      invoiceDate: invoice.invoiceDate
        ? new Date(invoice.invoiceDate as Date).toISOString()
        : null,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate as Date).toISOString() : null,
      poNumber: (invoice.poNumber as string) || undefined,
      currency: (invoice.currency as string) || 'USD',
      status: (invoice.status as string) || 'Draft',
      subtotal: Number(invoice.subtotal ?? invoice.subTotal ?? 0),
      discount: invoice.discount != null ? Number(invoice.discount) : undefined,
      tax: invoice.tax != null ? Number(invoice.tax) : undefined,
      total,
      amountPaid,
      balanceDue: Math.max(total - amountPaid, 0),
      notes: (invoice.notes as string) || undefined,
      termsAndConditions: Array.isArray(invoice.termsAndConditions)
        ? (invoice.termsAndConditions as string[])
        : undefined,
      paymentInstructions: (invoice.paymentInstructions as string) || undefined,
    },
    company,
    client,
    items,
    payments,
  };
}

// ---------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------

export async function loadEstimateForPdf(
  estimateId: string,
): Promise<PublicEstimateDetailResult | Unauthorized> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const _id = assertObjectId(estimateId);
  if (!_id) return { ok: false, error: 'Invalid id.', status: 404 };

  const { db } = await connectToDatabase();
  const estimate = await db.collection('crm_estimates').findOne({ _id, userId: owner.userId });
  if (!estimate) return { ok: false, error: 'Not found.', status: 404 };

  const company = await loadCompany(db, owner.userId);
  const client = await loadAccount(db, estimate.accountId);
  const items = mapLineItems(estimate.lineItems);

  let signature: PublicEstimateDetail['estimate']['signature'] = null;
  if (estimate.status === 'accepted') {
    const sig = await db
      .collection('accept_estimates')
      .findOne({ estimateId: estimate._id }, { sort: { signedAt: -1 } });
    if (sig) {
      signature = {
        signedByName: (sig.signedByName as string) || '',
        signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
        signatureDataUrl: (sig.signatureDataUrl as string) || '',
      };
    }
  }

  return {
    ok: true,
    estimate: {
      _id: estimate._id.toString(),
      estimateNumber:
        (estimate.estimateNumber as string) || (estimate.estimateNo as string) || '',
      estimateDate: estimate.estimateDate
        ? new Date(estimate.estimateDate as Date).toISOString()
        : estimate.createdAt
          ? new Date(estimate.createdAt as Date).toISOString()
          : null,
      validTill: estimate.validTill
        ? new Date(estimate.validTill as Date).toISOString()
        : estimate.validUntil
          ? new Date(estimate.validUntil as Date).toISOString()
          : null,
      currency: (estimate.currency as string) || 'USD',
      status: (estimate.status as string) || 'waiting',
      subtotal: Number(estimate.subtotal ?? estimate.subTotal ?? estimate.total ?? 0),
      tax: estimate.tax != null ? Number(estimate.tax) : undefined,
      discount: estimate.discount != null ? Number(estimate.discount) : undefined,
      total: Number(estimate.total ?? 0),
      notes: (estimate.notes as string) || undefined,
      termsAndConditions: Array.isArray(estimate.termsAndConditions)
        ? (estimate.termsAndConditions as string[])
        : undefined,
      signed: !!signature,
      signature,
    },
    company,
    client,
    items,
  };
}

// ---------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------

export async function loadProposalForPdf(
  proposalId: string,
): Promise<PublicProposalDetailResult | Unauthorized> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const _id = assertObjectId(proposalId);
  if (!_id) return { ok: false, error: 'Invalid id.', status: 404 };

  const { db } = await connectToDatabase();
  const proposal = await db.collection('crm_proposals').findOne({ _id, userId: owner.userId });
  if (!proposal) return { ok: false, error: 'Not found.', status: 404 };

  const company = await loadCompany(db, owner.userId);
  const items = mapLineItems(proposal.lineItems);

  let deal: PublicProposalDetail['deal'] = {};
  const dealRef = proposal.dealId || proposal.accountId || proposal.contactId;
  if (dealRef) {
    try {
      const id = typeof dealRef === 'string' ? new ObjectId(dealRef) : dealRef;
      const doc =
        (await db.collection('crm_deals').findOne({ _id: id })) ||
        (await db.collection('crm_accounts').findOne({ _id: id })) ||
        (await db.collection('crm_contacts').findOne({ _id: id }));
      if (doc) {
        deal = {
          name:
            (doc.name as string) ||
            (doc.accountName as string) ||
            `${(doc.firstName as string) || ''} ${(doc.lastName as string) || ''}`.trim(),
          email: (doc.email as string) || '',
          phone: (doc.phone as string) || '',
          address: (doc.address as string) || (doc.billingAddress as string) || '',
          company: (doc.company as string) || (doc.accountName as string) || '',
        };
      }
    } catch {
      /* non-fatal */
    }
  }

  let signature: PublicProposalDetail['proposal']['signature'] = null;
  if (proposal.status === 'accepted') {
    const sig = await db
      .collection('crm_proposal_signs')
      .findOne({ proposalId: proposal._id }, { sort: { signedAt: -1 } });
    if (sig) {
      signature = {
        signedByName: (sig.signedByName as string) || '',
        signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
        signatureDataUrl: (sig.signatureDataUrl as string) || '',
      };
    }
  }

  return {
    ok: true,
    proposal: {
      _id: proposal._id.toString(),
      proposalNumber:
        (proposal.proposalNumber as string) || (proposal.proposalNo as string) || '',
      title: (proposal.title as string) || '',
      proposalDate: proposal.proposalDate
        ? new Date(proposal.proposalDate as Date).toISOString()
        : proposal.createdAt
          ? new Date(proposal.createdAt as Date).toISOString()
          : null,
      validTill: proposal.validTill
        ? new Date(proposal.validTill as Date).toISOString()
        : proposal.validUntil
          ? new Date(proposal.validUntil as Date).toISOString()
          : null,
      currency: (proposal.currency as string) || 'USD',
      status: (proposal.status as string) || 'waiting',
      description: (proposal.description as string) || (proposal.body as string) || '',
      note: (proposal.note as string) || (proposal.notes as string) || undefined,
      subtotal: proposal.subtotal != null ? Number(proposal.subtotal) : undefined,
      tax: proposal.tax != null ? Number(proposal.tax) : undefined,
      total: Number(proposal.total ?? 0),
      signed: !!signature,
      signature,
    },
    company,
    deal,
    items,
  };
}

// ---------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------

export async function loadContractForPdf(
  contractId: string,
): Promise<PublicContractDetailResult | Unauthorized> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const _id = assertObjectId(contractId);
  if (!_id) return { ok: false, error: 'Invalid id.', status: 404 };

  const { db } = await connectToDatabase();
  const contract = await db.collection('crm_contracts').findOne({ _id, userId: owner.userId });
  if (!contract) return { ok: false, error: 'Not found.', status: 404 };

  const company = await loadCompany(db, owner.userId);

  let client: PublicContractDetail['client'] = {};
  const clientRef = contract.accountId || contract.contactId || contract.clientId;
  if (clientRef) {
    try {
      const id = typeof clientRef === 'string' ? new ObjectId(clientRef) : clientRef;
      const cdoc =
        (await db.collection('crm_accounts').findOne({ _id: id })) ||
        (await db.collection('crm_contacts').findOne({ _id: id }));
      if (cdoc) {
        client = {
          name:
            (cdoc.name as string) ||
            (cdoc.accountName as string) ||
            `${(cdoc.firstName as string) || ''} ${(cdoc.lastName as string) || ''}`.trim(),
          email: (cdoc.email as string) || '',
          phone: (cdoc.phone as string) || '',
          address: (cdoc.address as string) || (cdoc.billingAddress as string) || '',
        };
      }
    } catch {
      /* non-fatal */
    }
  }

  let clientSig: PublicContractDetail['signature']['client'] = null;
  let companySig: PublicContractDetail['signature']['company'] = null;
  try {
    const sigs = await db
      .collection('contract_signs')
      .find({ contractId: contract._id })
      .sort({ signedAt: -1 })
      .toArray();
    for (const sig of sigs) {
      const shape = {
        fullName: (sig.fullName as string) || '',
        signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
        signatureDataUrl: (sig.signatureDataUrl as string) || '',
        place: (sig.place as string) || '',
      };
      if (sig.party === 'company' && !companySig) companySig = shape;
      else if (!clientSig) clientSig = shape;
    }
  } catch {
    /* non-fatal */
  }

  return {
    ok: true,
    contract: {
      _id: contract._id.toString(),
      contractName:
        (contract.name as string) ||
        (contract.subject as string) ||
        (contract.contract_name as string) ||
        '',
      contractNumber:
        (contract.contractNumber as string) || (contract.contract_number as string) || undefined,
      contractDate: contract.contractDate
        ? new Date(contract.contractDate as Date).toISOString()
        : contract.createdAt
          ? new Date(contract.createdAt as Date).toISOString()
          : null,
      startDate: contract.startDate ? new Date(contract.startDate as Date).toISOString() : null,
      endDate: contract.endDate ? new Date(contract.endDate as Date).toISOString() : null,
      amount: contract.amount != null ? Number(contract.amount) : undefined,
      currency: (contract.currency as string) || 'USD',
      partyFirst:
        (contract.partyFirst as string) || (contract.first_party as string) || undefined,
      partySecond:
        (contract.partySecond as string) || (contract.second_party as string) || undefined,
      contractDetail:
        (contract.contract_detail as string) ||
        (contract.contractDetail as string) ||
        (contract.body as string) ||
        '',
      signed: !!contract.signed,
    },
    company,
    client,
    signature: { company: companySig, client: clientSig },
  };
}

// ---------------------------------------------------------------------
// Credit Note
// ---------------------------------------------------------------------

export type CreditNoteOriginalInvoiceRef = {
  invoiceNumber?: string;
  invoiceDate?: string | null;
  total?: number;
} | null;

export type CreditNoteForPdfOk = {
  ok: true;
  creditNote: {
    _id: string;
    creditNoteNumber: string;
    creditNoteDate: string | null;
    currency: string;
    subtotal?: number;
    tax?: number;
    discount?: number;
    total: number;
    reason?: string;
    notes?: string;
  };
  company: PublicInvoiceDetail['company'];
  client: PublicInvoiceDetail['client'];
  items: PublicInvoiceDetail['items'];
  originalInvoice: CreditNoteOriginalInvoiceRef;
};

export type CreditNoteForPdfResult = CreditNoteForPdfOk | Unauthorized;

export async function loadCreditNoteForPdf(noteId: string): Promise<CreditNoteForPdfResult> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const _id = assertObjectId(noteId);
  if (!_id) return { ok: false, error: 'Invalid id.', status: 404 };

  const { db } = await connectToDatabase();
  const note = await db
    .collection('crm_credit_notes')
    .findOne({ _id, userId: owner.userId });
  if (!note) return { ok: false, error: 'Not found.', status: 404 };

  const company = await loadCompany(db, owner.userId);
  const client = await loadAccount(db, note.accountId);
  const items = mapLineItems(note.lineItems);

  let originalInvoice: CreditNoteOriginalInvoiceRef = null;
  if (note.originalInvoiceNumber || note.originalInvoiceId) {
    try {
      let inv = null;
      if (note.originalInvoiceId) {
        const id =
          typeof note.originalInvoiceId === 'string'
            ? new ObjectId(note.originalInvoiceId)
            : note.originalInvoiceId;
        inv = await db.collection('crm_invoices').findOne({ _id: id });
      } else if (note.originalInvoiceNumber) {
        inv = await db.collection('crm_invoices').findOne({
          userId: owner.userId,
          invoiceNumber: note.originalInvoiceNumber,
        });
      }
      if (inv) {
        originalInvoice = {
          invoiceNumber: (inv.invoiceNumber as string) || undefined,
          invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate as Date).toISOString() : null,
          total: inv.total != null ? Number(inv.total) : undefined,
        };
      } else if (note.originalInvoiceNumber) {
        originalInvoice = { invoiceNumber: note.originalInvoiceNumber as string };
      }
    } catch {
      /* non-fatal */
    }
  }

  return {
    ok: true,
    creditNote: {
      _id: note._id.toString(),
      creditNoteNumber: (note.creditNoteNumber as string) || '',
      creditNoteDate: note.creditNoteDate
        ? new Date(note.creditNoteDate as Date).toISOString()
        : null,
      currency: (note.currency as string) || 'USD',
      subtotal: note.subtotal != null ? Number(note.subtotal) : undefined,
      tax: note.tax != null ? Number(note.tax) : undefined,
      discount: note.discount != null ? Number(note.discount) : undefined,
      total: Number(note.total ?? 0),
      reason: (note.reason as string) || undefined,
      notes: (note.notes as string) || undefined,
    },
    company,
    client,
    items,
    originalInvoice,
  };
}
