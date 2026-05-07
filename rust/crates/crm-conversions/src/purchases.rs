//! Purchases-side conversion pipeline (§13.5).
//!
//! Purchase Order → (GRN, Bill); GRN → Bill; Bill → Debit Note. Each
//! helper is a pure transformation: the parent's ownership scope and
//! `lineage[]` propagate forward to the child.
//!
//! GRN lives in [`crm_extras_types`] (§12.4) — not in
//! [`crm_purchases_types`] — so this module imports across both crates.
//!
//! No I/O. The server actions that call these are responsible for
//! persisting the child doc and patching the parent's
//! `linked_grn_ids` / `linked_bill_ids` arrays.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity, build_lineage_from_parent};
use crm_extras_types::{Grn, GrnLineItem, GrnStatus};
use crm_purchases_types::{
    Bill, BillStatus, DebitNote, DebitNoteReason, DebitNoteStatus, PurchaseOrder,
};
use crm_sales_types::{RefundMode, Totals};

/* ============================================================== */
/*  Purchase Order → GRN                                           */
/* ============================================================== */

/// Convert a `PurchaseOrder` into a `Grn`. Each PO `LineItem` becomes a
/// `GrnLineItem` with `ordered_qty = li.qty` and `received_qty /
/// accepted_qty / rejected_qty = 0` — the inspector fills these as
/// goods land. Lines without a catalog `item_id` (free-text PO rows)
/// are dropped because GRN tracking requires a SKU.
pub fn purchase_order_to_grn(po: &PurchaseOrder, grn_no: String) -> Grn {
    let lineage = build_lineage_from_parent("purchaseOrder", po.identity.id, &po.lineage);

    let items: Vec<GrnLineItem> = po
        .items
        .iter()
        .filter_map(|li| {
            li.item_id.map(|item_id| GrnLineItem {
                item_id,
                ordered_qty: li.qty,
                received_qty: 0.0,
                accepted_qty: 0.0,
                rejected_qty: 0.0,
                batch: None,
                expiry: None,
                serial_nos: Vec::new(),
            })
        })
        .collect();

    Grn {
        identity: Identity {
            id: ObjectId::new(),
            project_id: po.identity.project_id,
            user_id: po.identity.user_id,
            tenant_id: po.identity.tenant_id,
        },
        audit: Audit::new(None),

        grn_no,
        date: chrono::Utc::now(),

        po_id: Some(po.identity.id),
        vendor_id: po.vendor_id,
        // Fall back to a fresh ObjectId placeholder when the PO didn't
        // pre-pin a receiving warehouse. Callers that care should set
        // `ship_to_warehouse_id` on the PO upstream — this is a
        // last-resort default so the GRN type stays well-formed.
        // (Not `unwrap_or_default()`: that yields the zero-oid, which
        // would silently collide with any other defaulted record.)
        #[allow(clippy::unwrap_or_default)]
        warehouse_id: po.ship_to_warehouse_id.unwrap_or_else(ObjectId::new),

        items,

        inspector_id: None,
        attachments: Vec::new(),

        status: GrnStatus::default(),
        gin_id: None,
        mrn_id: None,

        lineage,
    }
}

/* ============================================================== */
/*  Purchase Order → Bill                                          */
/* ============================================================== */

/// Convert a `PurchaseOrder` into a `Bill`. Inventory line items +
/// totals copy across; `linked_po_id = Some(po._id)`. The caller
/// supplies `vendor_invoice_no` / dates / TDS upstream as the vendor's
/// physical invoice arrives — those are not derivable from the PO alone.
pub fn purchase_order_to_bill(po: &PurchaseOrder, bill_no: String) -> Bill {
    let lineage = build_lineage_from_parent("purchaseOrder", po.identity.id, &po.lineage);

    Bill {
        identity: Identity {
            id: ObjectId::new(),
            project_id: po.identity.project_id,
            user_id: po.identity.user_id,
            tenant_id: po.identity.tenant_id,
        },
        audit: Audit::new(None),
        assignment: po.assignment.clone(),

        bill_no: Some(bill_no),
        vendor_invoice_no: None,
        bill_date: chrono::Utc::now(),
        due_date: None,

        vendor_id: po.vendor_id,

        items: po.items.clone(),
        expense_lines: Vec::new(),

        tds_section: None,
        tds_amount: None,
        reverse_charge: false,
        place_of_supply: None,

        currency: po.currency.clone(),
        exchange_rate: po.exchange_rate,
        totals: po.totals.clone(),

        amount_paid: 0.0,
        balance: po.totals.total,

        recurring: None,

        attachments: po.attachments.clone(),
        notes: po.notes.clone(),

        status: BillStatus::default(),
        linked_po_id: Some(po.identity.id),
        linked_grn_ids: Vec::new(),
        lineage,
    }
}

/* ============================================================== */
/*  GRN → Bill                                                     */
/* ============================================================== */

/// Convert a `Grn` into a `Bill`. GRN line items only carry qty (no
/// rate / tax) so the caller must supply pre-computed `Totals` — and
/// is expected to populate `Bill.items` post-construction with rates
/// looked up against the source PO or a vendor price list. We propagate
/// ids + lineage and leave both `items` and `expense_lines` empty so
/// the caller's downstream pricing pass owns those fields exclusively.
pub fn grn_to_bill(grn: &Grn, bill_no: String, vendor_id: ObjectId, totals: Totals) -> Bill {
    let lineage = build_lineage_from_parent("grn", grn.identity.id, &grn.lineage);
    let bill_total = totals.total;

    Bill {
        identity: Identity {
            id: ObjectId::new(),
            project_id: grn.identity.project_id,
            user_id: grn.identity.user_id,
            tenant_id: grn.identity.tenant_id,
        },
        audit: Audit::new(None),
        assignment: Default::default(),

        bill_no: Some(bill_no),
        vendor_invoice_no: None,
        bill_date: chrono::Utc::now(),
        due_date: None,

        vendor_id,

        // Caller fills these — see fn-doc.
        items: Vec::new(),
        expense_lines: Vec::new(),

        tds_section: None,
        tds_amount: None,
        reverse_charge: false,
        place_of_supply: None,

        currency: String::new(),
        exchange_rate: None,
        totals,

        amount_paid: 0.0,
        balance: bill_total,

        recurring: None,

        attachments: Vec::new(),
        notes: None,

        status: BillStatus::default(),
        linked_po_id: grn.po_id,
        linked_grn_ids: vec![grn.identity.id],
        lineage,
    }
}

/* ============================================================== */
/*  Bill → Debit Note                                              */
/* ============================================================== */

/// Convert a `Bill` into a `DebitNote`. Items + totals are mirrored
/// (caller adjusts line quantities upstream for partial returns);
/// `refund_mode` defaults to [`RefundMode::Replacement`] (vendor ships
/// replacement goods rather than refunding cash) — flip to `Cash` /
/// `Credit` post-construction as appropriate.
pub fn bill_to_debit_note(bill: &Bill, dn_no: String, reason: DebitNoteReason) -> DebitNote {
    let lineage = build_lineage_from_parent("bill", bill.identity.id, &bill.lineage);

    DebitNote {
        identity: Identity {
            id: ObjectId::new(),
            project_id: bill.identity.project_id,
            user_id: bill.identity.user_id,
            tenant_id: bill.identity.tenant_id,
        },
        audit: Audit::new(None),
        assignment: bill.assignment.clone(),

        dn_no,
        date: chrono::Utc::now(),

        vendor_id: bill.vendor_id,
        linked_bill_id: Some(bill.identity.id),
        reason,

        currency: bill.currency.clone(),
        exchange_rate: bill.exchange_rate,

        items: bill.items.clone(),
        totals: bill.totals.clone(),

        refund_mode: RefundMode::Replacement,
        refund_txn_id: None,

        notes: None,
        attachments: Vec::new(),

        status: DebitNoteStatus::default(),
        lineage,
    }
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crm_core::{Assignment, LineageRef};
    use crm_purchases_types::ApprovalWorkflow;
    use crm_sales_types::{LineItem, Totals};

    fn sample_po() -> PurchaseOrder {
        PurchaseOrder {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Assignment::default(),
            po_no: "PO-001".into(),
            date: Utc::now(),
            expected_delivery: None,
            vendor_id: ObjectId::new(),
            ship_to_warehouse_id: Some(ObjectId::new()),
            billing_branch_id: None,
            shipping_address: None,
            payment_terms: None,
            currency: "INR".into(),
            exchange_rate: None,
            items: vec![LineItem {
                item_id: Some(ObjectId::new()),
                qty: 10.0,
                rate: 50.0,
                total: 500.0,
                ..Default::default()
            }],
            totals: Totals {
                sub_total: 500.0,
                total: 500.0,
                ..Default::default()
            },
            terms_and_conditions: None,
            notes: None,
            attachments: Vec::new(),
            approval: ApprovalWorkflow::default(),
            status: Default::default(),
            linked_grn_ids: Vec::new(),
            linked_bill_ids: Vec::new(),
            lineage: vec![LineageRef::new("rfq", ObjectId::new())],
        }
    }

    #[test]
    fn purchase_order_to_grn_propagates_lineage_and_ref() {
        let po = sample_po();
        let grn = purchase_order_to_grn(&po, "GRN-001".into());

        assert_eq!(grn.identity.project_id, po.identity.project_id);
        assert_eq!(grn.identity.user_id, po.identity.user_id);
        assert_ne!(grn.identity.id, po.identity.id);

        // Lineage = rfq + purchaseOrder.
        assert_eq!(grn.lineage.len(), po.lineage.len() + 1);
        assert_eq!(grn.lineage.last().unwrap().kind, "purchaseOrder");
        assert_eq!(grn.lineage.last().unwrap().id, po.identity.id);

        // Back-link + warehouse pulled from PO.
        assert_eq!(grn.po_id, Some(po.identity.id));
        assert_eq!(grn.vendor_id, po.vendor_id);
        assert_eq!(grn.warehouse_id, po.ship_to_warehouse_id.unwrap());

        // Line conversion: ordered = qty, received/accepted/rejected = 0.
        assert_eq!(grn.items.len(), 1);
        assert_eq!(grn.items[0].ordered_qty, 10.0);
        assert_eq!(grn.items[0].received_qty, 0.0);
        assert_eq!(grn.items[0].accepted_qty, 0.0);
        assert_eq!(grn.items[0].rejected_qty, 0.0);
    }

    #[test]
    fn purchase_order_to_bill_carries_items_and_links() {
        let po = sample_po();
        let bill = purchase_order_to_bill(&po, "BILL-001".into());

        assert_eq!(bill.identity.project_id, po.identity.project_id);
        assert_eq!(bill.identity.user_id, po.identity.user_id);
        assert_eq!(bill.lineage.last().unwrap().kind, "purchaseOrder");
        assert_eq!(bill.lineage.last().unwrap().id, po.identity.id);

        assert_eq!(bill.linked_po_id, Some(po.identity.id));
        assert_eq!(bill.vendor_id, po.vendor_id);
        assert_eq!(bill.bill_no.as_deref(), Some("BILL-001"));
        assert_eq!(bill.items.len(), po.items.len());
        assert_eq!(bill.balance, po.totals.total);
    }

    #[test]
    fn grn_to_bill_propagates_lineage_and_links() {
        let po = sample_po();
        let grn = purchase_order_to_grn(&po, "GRN-001".into());

        let totals = Totals {
            sub_total: 500.0,
            total: 500.0,
            ..Default::default()
        };
        let vendor = ObjectId::new();
        let bill = grn_to_bill(&grn, "BILL-002".into(), vendor, totals);

        assert_eq!(bill.identity.project_id, grn.identity.project_id);
        assert_eq!(bill.identity.user_id, grn.identity.user_id);
        // Chain: rfq → purchaseOrder → grn.
        assert_eq!(bill.lineage.last().unwrap().kind, "grn");
        assert_eq!(bill.lineage.last().unwrap().id, grn.identity.id);

        assert_eq!(bill.vendor_id, vendor);
        assert_eq!(bill.linked_po_id, grn.po_id);
        assert_eq!(bill.linked_grn_ids, vec![grn.identity.id]);
        // Items left empty for caller.
        assert!(bill.items.is_empty());
        assert_eq!(bill.totals.total, 500.0);
        assert_eq!(bill.balance, 500.0);
    }

    #[test]
    fn bill_to_debit_note_links_back_to_bill() {
        let po = sample_po();
        let bill = purchase_order_to_bill(&po, "BILL-001".into());
        let dn = bill_to_debit_note(&bill, "DN-001".into(), DebitNoteReason::Return);

        assert_eq!(dn.identity.project_id, bill.identity.project_id);
        assert_eq!(dn.identity.user_id, bill.identity.user_id);
        assert_eq!(dn.lineage.last().unwrap().kind, "bill");
        assert_eq!(dn.lineage.last().unwrap().id, bill.identity.id);

        assert_eq!(dn.linked_bill_id, Some(bill.identity.id));
        assert_eq!(dn.vendor_id, bill.vendor_id);
        assert!(matches!(dn.refund_mode, RefundMode::Replacement));
        assert!(matches!(dn.reason, DebitNoteReason::Return));
        assert_eq!(dn.items.len(), bill.items.len());
    }
}
