//! Sales-side conversion pipeline (§13.5).
//!
//! Quotation → Sales Order → (Delivery Challan, Invoice → Credit Note)
//! and Quotation → Proforma. Each helper is a pure, deterministic
//! transformation: takes the parent by `&`, returns an owned child whose
//! `Identity` inherits ownership and whose `lineage[]` extends the
//! parent's chain via [`crm_core::build_lineage_from_parent`].
//!
//! No I/O. The server actions that wrap these are responsible for
//! persisting the child doc and patching the parent's `convertedTo` /
//! `linked*Ids` arrays.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity, build_lineage_from_parent};
use crm_sales_types::{
    Address, ChallanLineItem, CreditNote, CreditNoteReason, CreditNoteStatus, DeliveryChallan,
    DeliveryChallanStatus, Invoice, InvoiceStatus, ProformaInvoice, ProformaStatus, Quotation,
    RefundMode, SalesOrder, SalesOrderStatus,
};

/* ============================================================== */
/*  Quotation → Sales Order                                        */
/* ============================================================== */

/// Convert a `Quotation` into a `SalesOrder`. Copies client / currency /
/// addresses / items / totals; stamps `quotation_ref = Some(q._id)` and
/// extends `lineage[]` with the quotation as the new tail.
///
/// The `user_id` parameter overrides the SO's `Identity.user_id` —
/// useful when the SO is being created on behalf of a different owner
/// (e.g. round-robin assignment). For straight conversions, callers
/// should pass `q.identity.user_id`.
pub fn quotation_to_sales_order(
    q: &Quotation,
    so_no: String,
    user_id: ObjectId,
) -> SalesOrder {
    let lineage = build_lineage_from_parent("quotation", q.identity.id, &q.lineage);

    SalesOrder {
        identity: Identity {
            id: ObjectId::new(),
            project_id: q.identity.project_id,
            user_id,
            tenant_id: q.identity.tenant_id,
        },
        audit: Audit::new(None),
        attribution: q.attribution.clone(),
        assignment: q.assignment.clone(),

        so_no,
        date: chrono::Utc::now(),

        client_id: q.client_id,
        quotation_ref: Some(q.identity.id),
        po_no: None,
        po_date: None,

        expected_shipment_date: None,
        delivery_method: None,
        payment_terms: None,
        shipping_address: q.shipping_address.clone(),

        currency: q.currency.clone(),
        exchange_rate: q.exchange_rate,

        items: q.items.clone(),
        totals: q.totals.clone(),

        customer_notes: q.customer_notes.clone(),
        internal_notes: None,
        attachments: q.attachments.clone(),

        status: SalesOrderStatus::default(),
        linked_delivery_ids: Vec::new(),
        linked_invoice_ids: Vec::new(),
        lineage,
        design_metadata: None,
    }
}

/* ============================================================== */
/*  Quotation → Invoice                                            */
/* ============================================================== */

/// Convert a `Quotation` directly into an `Invoice` (skipping the SO
/// step — common for service-only deals). Copies client / currency /
/// addresses / items / totals; lineage carries the quotation forward.
pub fn quotation_to_invoice(q: &Quotation, invoice_no: String) -> Invoice {
    let lineage = build_lineage_from_parent("quotation", q.identity.id, &q.lineage);

    Invoice {
        identity: Identity {
            id: ObjectId::new(),
            project_id: q.identity.project_id,
            user_id: q.identity.user_id,
            tenant_id: q.identity.tenant_id,
        },
        audit: Audit::new(None),
        attribution: q.attribution.clone(),
        assignment: q.assignment.clone(),

        invoice_no,
        date: chrono::Utc::now(),
        due_date: chrono::Utc::now(),

        client_id: q.client_id,
        place_of_supply: q.place_of_supply.clone(),
        reverse_charge: false,
        gst_treatment: Default::default(),

        currency: q.currency.clone(),
        exchange_rate: q.exchange_rate,

        billing_address: q.billing_address.clone(),
        shipping_address: q.shipping_address.clone(),

        items: q.items.clone(),
        totals: q.totals.clone(),

        tcs_pct: None,
        tds_pct: None,

        amount_paid: 0.0,
        balance: q.totals.total,
        payment_terms: None,

        bank_details: None,
        upi_id: None,
        qr_image_file_id: None,

        customer_notes: q.customer_notes.clone(),
        terms_and_conditions: q.terms_and_conditions.clone(),

        e_invoice: None,
        eway_bill_no: None,

        attachments: q.attachments.clone(),
        template_id: q.template_id,
        thumbnail_file_id: None,
        signature_image_file_id: q.signature_image_file_id,
        pdf_status: Default::default(),
        email_log: Vec::new(),
        whatsapp_send_log: Vec::new(),

        recurring: None,
        status: InvoiceStatus::default(),
        lineage,
        design_metadata: None,
    }
}

/* ============================================================== */
/*  Quotation → Proforma                                           */
/* ============================================================== */

/// Convert a `Quotation` into a `ProformaInvoice`. Proforma re-uses the
/// quotation's `valid_until` as its own validity (caller can override
/// upstream if business rules require a different window).
pub fn quotation_to_proforma(q: &Quotation, proforma_no: String) -> ProformaInvoice {
    let lineage = build_lineage_from_parent("quotation", q.identity.id, &q.lineage);

    ProformaInvoice {
        identity: Identity {
            id: ObjectId::new(),
            project_id: q.identity.project_id,
            user_id: q.identity.user_id,
            tenant_id: q.identity.tenant_id,
        },
        audit: Audit::new(None),
        attribution: q.attribution.clone(),
        assignment: q.assignment.clone(),

        proforma_no,
        date: chrono::Utc::now(),
        valid_until: q.valid_until,

        client_id: q.client_id,
        linked_so_id: None,
        reference_no: q.reference_no.clone(),
        sales_agent_id: q.sales_agent_id,
        deal_id: q.deal_id,
        subject: q.subject.clone(),

        currency: q.currency.clone(),
        exchange_rate: q.exchange_rate,
        place_of_supply: q.place_of_supply.clone(),

        billing_address: q.billing_address.clone(),
        shipping_address: q.shipping_address.clone(),

        items: q.items.clone(),
        totals: q.totals.clone(),

        advance_pct: None,
        advance_amount: None,
        expected_delivery: None,
        payment_due_date: None,

        terms_and_conditions: q.terms_and_conditions.clone(),
        customer_notes: q.customer_notes.clone(),
        attachments: q.attachments.clone(),

        signature_image_file_id: q.signature_image_file_id,
        template_id: q.template_id,
        thumbnail_file_id: None,
        pdf_status: Default::default(),

        email_log: Vec::new(),
        whatsapp_send_log: Vec::new(),

        status: ProformaStatus::default(),
        converted_to: Vec::new(),
        lineage,
    }
}

/* ============================================================== */
/*  Sales Order → Delivery Challan                                 */
/* ============================================================== */

/// Convert a `SalesOrder` into a `DeliveryChallan`. Each `LineItem`
/// becomes a `ChallanLineItem` (item_id / qty / unit / description
/// preserved); `batch`, `expiry`, and `serial_nos` start empty — the
/// dispatch desk fills these as goods are picked.
pub fn sales_order_to_delivery_challan(
    so: &SalesOrder,
    challan_no: String,
    dispatch_warehouse_id: ObjectId,
    ship_to: Address,
) -> DeliveryChallan {
    let lineage = build_lineage_from_parent("salesOrder", so.identity.id, &so.lineage);

    let items: Vec<ChallanLineItem> = so
        .items
        .iter()
        .filter_map(|li| {
            // ChallanLineItem requires an item_id; ad-hoc rows without
            // a catalog reference can't be physically dispatched, so
            // we drop them here.
            li.item_id.map(|item_id| ChallanLineItem {
                item_id,
                description: li.description.clone(),
                qty: li.qty,
                unit: li.unit.clone(),
                batch: None,
                expiry: None,
                serial_nos: Vec::new(),
            })
        })
        .collect();

    DeliveryChallan {
        identity: Identity {
            id: ObjectId::new(),
            project_id: so.identity.project_id,
            user_id: so.identity.user_id,
            tenant_id: so.identity.tenant_id,
        },
        audit: Audit::new(None),
        assignment: so.assignment.clone(),

        challan_no,
        date: chrono::Utc::now(),

        so_ref: Some(so.identity.id),
        client_id: so.client_id,

        vehicle_no: None,
        driver_name: None,
        driver_phone: None,
        transporter: None,
        lr_no: None,
        lr_date: None,
        mode_of_transport: Default::default(),
        eway_bill_no: None,

        items,
        dispatch_warehouse_id,
        ship_to_address: ship_to,
        reason_for_transport: Default::default(),
        reason_note: None,
        attachments: Vec::new(),

        status: DeliveryChallanStatus::default(),
        lineage,
        design_metadata: None,
    }
}

/* ============================================================== */
/*  Sales Order → Invoice                                          */
/* ============================================================== */

/// Convert a `SalesOrder` into an `Invoice`. Copies items / totals /
/// addresses / currency. The SO-only fulfillment fields on each
/// `LineItem` (`warehouse_id` / `qty_pending` / …) ride along — they're
/// optional so they round-trip harmlessly even on the invoice.
pub fn sales_order_to_invoice(so: &SalesOrder, invoice_no: String) -> Invoice {
    let lineage = build_lineage_from_parent("salesOrder", so.identity.id, &so.lineage);

    Invoice {
        identity: Identity {
            id: ObjectId::new(),
            project_id: so.identity.project_id,
            user_id: so.identity.user_id,
            tenant_id: so.identity.tenant_id,
        },
        audit: Audit::new(None),
        attribution: so.attribution.clone(),
        assignment: so.assignment.clone(),

        invoice_no,
        date: chrono::Utc::now(),
        due_date: chrono::Utc::now(),

        client_id: so.client_id,
        place_of_supply: None,
        reverse_charge: false,
        gst_treatment: Default::default(),

        currency: so.currency.clone(),
        exchange_rate: so.exchange_rate,

        billing_address: None,
        shipping_address: so.shipping_address.clone(),

        items: so.items.clone(),
        totals: so.totals.clone(),

        tcs_pct: None,
        tds_pct: None,

        amount_paid: 0.0,
        balance: so.totals.total,
        payment_terms: so.payment_terms.clone(),

        bank_details: None,
        upi_id: None,
        qr_image_file_id: None,

        customer_notes: so.customer_notes.clone(),
        terms_and_conditions: None,

        e_invoice: None,
        eway_bill_no: None,

        attachments: so.attachments.clone(),
        template_id: None,
        thumbnail_file_id: None,
        signature_image_file_id: None,
        pdf_status: Default::default(),
        email_log: Vec::new(),
        whatsapp_send_log: Vec::new(),

        recurring: None,
        status: InvoiceStatus::default(),
        lineage,
        design_metadata: None,
    }
}

/* ============================================================== */
/*  Invoice → Credit Note                                          */
/* ============================================================== */

/// Convert an `Invoice` into a `CreditNote`. Items + totals are mirrored
/// (caller can adjust line quantities upstream for partial returns);
/// `refund_mode` defaults to [`RefundMode::Credit`] (held on the
/// customer ledger) — switch to `Cash` / `Replacement` post-construction
/// if needed.
pub fn invoice_to_credit_note(
    inv: &Invoice,
    cn_no: String,
    reason: CreditNoteReason,
) -> CreditNote {
    let lineage = build_lineage_from_parent("invoice", inv.identity.id, &inv.lineage);

    CreditNote {
        identity: Identity {
            id: ObjectId::new(),
            project_id: inv.identity.project_id,
            user_id: inv.identity.user_id,
            tenant_id: inv.identity.tenant_id,
        },
        audit: Audit::new(None),
        assignment: inv.assignment.clone(),

        cn_no,
        date: chrono::Utc::now(),

        client_id: inv.client_id,
        linked_invoice_id: Some(inv.identity.id),
        reason,

        currency: inv.currency.clone(),
        exchange_rate: inv.exchange_rate,

        items: inv.items.clone(),
        totals: inv.totals.clone(),

        tax_recalc: false,

        auto_apply: false,

        refund_mode: RefundMode::Credit,
        refund_txn_id: None,

        notes: None,
        attachments: Vec::new(),

        status: CreditNoteStatus::default(),
        lineage,
        design_metadata: None,
    }
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crm_core::{Assignment, Attribution, LineageRef};
    use crm_sales_types::{LineItem, Totals};

    fn sample_quotation() -> Quotation {
        let id = ObjectId::new();
        Quotation {
            identity: Identity {
                id,
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            attribution: Attribution::default(),
            assignment: Assignment::default(),
            quotation_no: "Q-001".into(),
            date: Utc::now(),
            valid_until: Utc::now(),
            client_id: ObjectId::new(),
            reference_no: None,
            sales_agent_id: None,
            deal_id: None,
            subject: None,
            currency: "INR".into(),
            exchange_rate: None,
            place_of_supply: None,
            billing_address: None,
            shipping_address: None,
            items: vec![LineItem {
                item_id: Some(ObjectId::new()),
                qty: 2.0,
                rate: 100.0,
                total: 200.0,
                ..Default::default()
            }],
            totals: Totals {
                sub_total: 200.0,
                total: 200.0,
                ..Default::default()
            },
            terms_and_conditions: None,
            customer_notes: None,
            attachments: Vec::new(),
            signature_image_file_id: None,
            template_id: None,
            thumbnail_file_id: None,
            pdf_status: Default::default(),
            email_log: Vec::new(),
            whatsapp_send_log: Vec::new(),
            status: Default::default(),
            converted_to: Vec::new(),
            lineage: vec![LineageRef::new("lead", ObjectId::new())],
            revision_history: Vec::new(),
        }
    }

    #[test]
    fn quotation_to_sales_order_propagates_lineage_and_ref() {
        let q = sample_quotation();
        let user = ObjectId::new();
        let so = quotation_to_sales_order(&q, "SO-001".into(), user);

        // Identity inherits scope (projectId carries; user_id is the
        // override the caller passed).
        assert_eq!(so.identity.project_id, q.identity.project_id);
        assert_eq!(so.identity.user_id, user);
        assert_eq!(so.identity.tenant_id, q.identity.tenant_id);
        assert_ne!(so.identity.id, q.identity.id);

        // Lineage = parent's chain + parent ref.
        assert_eq!(so.lineage.len(), q.lineage.len() + 1);
        assert_eq!(so.lineage.last().unwrap().kind, "quotation");
        assert_eq!(so.lineage.last().unwrap().id, q.identity.id);

        // Entity-specific link field.
        assert_eq!(so.quotation_ref, Some(q.identity.id));
        assert_eq!(so.so_no, "SO-001");
        assert_eq!(so.items.len(), q.items.len());
        assert_eq!(so.currency, q.currency);
    }

    #[test]
    fn quotation_to_invoice_propagates_lineage() {
        let q = sample_quotation();
        let inv = quotation_to_invoice(&q, "INV-001".into());

        assert_eq!(inv.identity.project_id, q.identity.project_id);
        assert_eq!(inv.identity.user_id, q.identity.user_id);
        assert_eq!(inv.lineage.last().unwrap().kind, "quotation");
        assert_eq!(inv.lineage.last().unwrap().id, q.identity.id);
        assert_eq!(inv.invoice_no, "INV-001");
        assert_eq!(inv.balance, q.totals.total);
    }

    #[test]
    fn quotation_to_proforma_carries_validity() {
        let q = sample_quotation();
        let pf = quotation_to_proforma(&q, "PF-001".into());

        assert_eq!(pf.identity.project_id, q.identity.project_id);
        assert_eq!(pf.identity.user_id, q.identity.user_id);
        assert_eq!(pf.valid_until, q.valid_until);
        assert_eq!(pf.lineage.last().unwrap().kind, "quotation");
        assert_eq!(pf.lineage.last().unwrap().id, q.identity.id);
        assert_eq!(pf.proforma_no, "PF-001");
    }

    #[test]
    fn sales_order_to_delivery_challan_maps_line_items() {
        let q = sample_quotation();
        let user = q.identity.user_id;
        let so = quotation_to_sales_order(&q, "SO-001".into(), user);

        let wh = ObjectId::new();
        let challan = sales_order_to_delivery_challan(
            &so,
            "DC-001".into(),
            wh,
            Address::default(),
        );

        assert_eq!(challan.identity.project_id, so.identity.project_id);
        assert_eq!(challan.identity.user_id, so.identity.user_id);
        // Lineage chain: lead → quotation → salesOrder.
        assert_eq!(challan.lineage.last().unwrap().kind, "salesOrder");
        assert_eq!(challan.lineage.last().unwrap().id, so.identity.id);
        // Back-link.
        assert_eq!(challan.so_ref, Some(so.identity.id));
        assert_eq!(challan.dispatch_warehouse_id, wh);
        // Items round-tripped.
        assert_eq!(challan.items.len(), so.items.len());
        assert_eq!(challan.items[0].qty, 2.0);
        // Batch/serial start empty.
        assert!(challan.items[0].batch.is_none());
        assert!(challan.items[0].serial_nos.is_empty());
    }

    #[test]
    fn sales_order_to_invoice_propagates_lineage() {
        let q = sample_quotation();
        let so = quotation_to_sales_order(&q, "SO-001".into(), q.identity.user_id);
        let inv = sales_order_to_invoice(&so, "INV-001".into());

        assert_eq!(inv.identity.project_id, so.identity.project_id);
        assert_eq!(inv.identity.user_id, so.identity.user_id);
        // Chain: lead → quotation → salesOrder.
        assert_eq!(inv.lineage.last().unwrap().kind, "salesOrder");
        assert_eq!(inv.lineage.last().unwrap().id, so.identity.id);
        assert_eq!(inv.balance, so.totals.total);
        assert_eq!(inv.currency, so.currency);
    }

    #[test]
    fn invoice_to_credit_note_links_back_to_invoice() {
        let q = sample_quotation();
        let inv = quotation_to_invoice(&q, "INV-001".into());
        let cn = invoice_to_credit_note(&inv, "CN-001".into(), CreditNoteReason::Return);

        assert_eq!(cn.identity.project_id, inv.identity.project_id);
        assert_eq!(cn.identity.user_id, inv.identity.user_id);
        assert_eq!(cn.lineage.last().unwrap().kind, "invoice");
        assert_eq!(cn.lineage.last().unwrap().id, inv.identity.id);
        assert_eq!(cn.linked_invoice_id, Some(inv.identity.id));
        assert!(matches!(cn.refund_mode, RefundMode::Credit));
        assert!(matches!(cn.reason, CreditNoteReason::Return));
        assert_eq!(cn.items.len(), inv.items.len());
    }
}
