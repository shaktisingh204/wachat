//! Integration round-trip tests for §2.1–§2.6 DTOs.

use bson::oid::ObjectId;
use chrono::Utc;
use crm_core::{Audit, Identity};
use crm_purchases_types::{
    ApprovalWorkflow, Bill, BillApplication, BillStatus, DebitNote, DebitNoteReason,
    DebitNoteStatus, ExpenseLine, PayoutReceipt, PayoutStatus, PurchaseLead, PurchaseLeadStage,
    PurchaseOrder, PurchaseOrderStatus, Vendor, VendorType,
};
use crm_sales_types::{ContactBook, LineItem, PaymentMode, RefundMode, Totals};

fn ids() -> (Identity, Audit) {
    (
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        },
        Audit::new(None),
    )
}

fn line_item() -> LineItem {
    LineItem {
        item_id: Some(ObjectId::new()),
        description: Some("Steel rod".into()),
        hsn_sac: Some("7214".into()),
        qty: 100.0,
        unit: Some("kg".into()),
        rate: 80.0,
        discount_pct: None,
        tax_rate_pct: Some(18.0),
        cgst_amount: Some(720.0),
        sgst_amount: Some(720.0),
        igst_amount: None,
        cess_amount: None,
        total: 9_440.0,
        warehouse_id: None,
        qty_pending: None,
        qty_delivered: None,
        qty_invoiced: None,
    }
}

fn totals() -> Totals {
    Totals {
        sub_total: 8_000.0,
        discount_overall: None,
        shipping_charge: None,
        adjustment: None,
        round_off: Some(0.0),
        total: 9_440.0,
    }
}

fn contact() -> ContactBook {
    ContactBook {
        primary_email: "sales@steelco.example".into(),
        alt_emails: vec![],
        primary_phone: "+91 9000000000".into(),
        alt_phones: vec![],
        whatsapp: None,
        telegram: None,
        linkedin: None,
        twitter: None,
        website: None,
    }
}

#[test]
fn vendor_carries_msme_and_tds_fields() {
    let (identity, audit) = ids();
    let v = Vendor {
        identity,
        audit,
        vendor_type: VendorType::Goods,
        first_name: "Anil".into(),
        last_name: "Sharma".into(),
        display_name: Some("SteelCo".into()),
        salutation: None,
        company_name: Some("SteelCo Pvt Ltd".into()),
        gstin: Some("27AAACS1234F1Z5".into()),
        pan: Some("AAACS1234F".into()),
        aadhaar_masked: None,
        cin: Some("U27109MH2010PTC123456".into()),
        industry: Some("Manufacturing".into()),
        sub_industry: None,
        designation: None,
        department: None,
        contact: contact(),
        currency: Some("INR".into()),
        credit_limit: Some(2_000_000.0),
        credit_period_days: Some(45),
        payment_terms: Some("Net 45".into()),
        tax_preference: Default::default(),
        tax_registration_no: None,
        place_of_supply: Some("Maharashtra".into()),
        billing_address: None,
        shipping_addresses: vec![],
        default_warehouse_id: None,
        default_discount_pct: None,
        default_tax_rate_id: None,
        opening_balance: None,
        avatar_file_id: None,
        dob: None,
        anniversary: None,
        preferred_contact_channel: None,
        preferred_language: None,
        timezone: None,
        msme_registered: true,
        msme_category: Some("small".into()),
        msme_number: Some("UDYAM-MH-19-0123456".into()),
        vendor_rating: Some(4),
        default_purchase_ledger_id: Some(ObjectId::new()),
        default_expense_ledger_id: None,
        tds_section: Some("194Q".into()),
        tds_rate: Some(0.1),
        lead_time_days: Some(14),
        min_order_qty: Some(50.0),
        vendor_portal_email: Some("portal@steelco.example".into()),
        assignment: Default::default(),
        tags: Default::default(),
        custom_fields: Default::default(),
        attachments: vec![],
        notes: vec![],
    };
    let json = serde_json::to_value(&v).unwrap();
    assert!(json.get("identity").is_none(), "Identity must flatten");
    assert!(json.get("_id").is_some());
    assert_eq!(
        json.get("vendorType").and_then(|x| x.as_str()),
        Some("goods")
    );
    assert_eq!(
        json.get("msmeRegistered").and_then(|x| x.as_bool()),
        Some(true)
    );
    assert_eq!(
        json.get("tdsSection").and_then(|x| x.as_str()),
        Some("194Q")
    );
    assert_eq!(
        json.get("vendorPortalEmail").and_then(|x| x.as_str()),
        Some("portal@steelco.example")
    );
    let back: Vendor = serde_json::from_value(json).unwrap();
    assert_eq!(back.vendor_type, VendorType::Goods);
    assert!(back.msme_registered);
    assert_eq!(back.lead_time_days, Some(14));
}

#[test]
fn purchase_order_carries_approval_and_links() {
    let (identity, audit) = ids();
    let po = PurchaseOrder {
        identity,
        audit,
        assignment: Default::default(),
        po_no: "PO-1".into(),
        date: Utc::now(),
        expected_delivery: Some(Utc::now()),
        vendor_id: ObjectId::new(),
        ship_to_warehouse_id: Some(ObjectId::new()),
        billing_branch_id: None,
        shipping_address: None,
        payment_terms: Some("Net 30".into()),
        currency: "INR".into(),
        exchange_rate: None,
        items: vec![line_item()],
        totals: totals(),
        terms_and_conditions: None,
        notes: None,
        attachments: vec![],
        approval: ApprovalWorkflow {
            requested_by: Some(ObjectId::new()),
            requested_at: Some(Utc::now()),
            approved_by: Some(ObjectId::new()),
            approved_at: Some(Utc::now()),
            note: Some("Per Q3 budget".into()),
        },
        status: PurchaseOrderStatus::Approved,
        linked_grn_ids: vec![ObjectId::new()],
        linked_bill_ids: vec![],
        lineage: vec![],
    };
    let json = serde_json::to_value(&po).unwrap();
    assert_eq!(
        json.get("status").and_then(|x| x.as_str()),
        Some("approved")
    );
    assert!(json.pointer("/approval/requestedBy").is_some());
    assert!(json.pointer("/linkedGrnIds/0").is_some());
    let back: PurchaseOrder = serde_json::from_value(json).unwrap();
    assert_eq!(back.status, PurchaseOrderStatus::Approved);
    assert_eq!(back.linked_grn_ids.len(), 1);
}

#[test]
fn bill_supports_items_and_expense_lines_simultaneously() {
    let (identity, audit) = ids();
    let b = Bill {
        identity,
        audit,
        assignment: Default::default(),
        bill_no: Some("BILL-1".into()),
        vendor_invoice_no: Some("VINV-9921".into()),
        bill_date: Utc::now(),
        due_date: Some(Utc::now()),
        vendor_id: ObjectId::new(),
        items: vec![line_item()],
        expense_lines: vec![ExpenseLine {
            account_id: ObjectId::new(),
            description: Some("Freight".into()),
            amount: 500.0,
            tax_rate_pct: Some(18.0),
            cgst_amount: Some(45.0),
            sgst_amount: Some(45.0),
            igst_amount: None,
            project_id: None,
        }],
        tds_section: Some("194C".into()),
        tds_amount: Some(80.0),
        reverse_charge: false,
        place_of_supply: Some("Maharashtra".into()),
        currency: "INR".into(),
        exchange_rate: None,
        totals: totals(),
        amount_paid: 0.0,
        balance: 9_440.0,
        recurring: None,
        attachments: vec![],
        notes: None,
        status: BillStatus::Submitted,
        linked_po_id: Some(ObjectId::new()),
        linked_grn_ids: vec![],
        lineage: vec![],
    };
    let json = serde_json::to_value(&b).unwrap();
    assert_eq!(
        json.get("status").and_then(|x| x.as_str()),
        Some("submitted")
    );
    assert!(json.pointer("/items/0").is_some());
    assert!(json.pointer("/expenseLines/0").is_some());
    assert_eq!(
        json.pointer("/expenseLines/0/amount")
            .and_then(|x| x.as_f64()),
        Some(500.0)
    );
    let back: Bill = serde_json::from_value(json).unwrap();
    assert_eq!(back.expense_lines.len(), 1);
    assert_eq!(back.items.len(), 1);
    assert_eq!(back.tds_amount, Some(80.0));
}

#[test]
fn debit_note_round_trips_with_refund_mode() {
    let (identity, audit) = ids();
    let dn = DebitNote {
        identity,
        audit,
        assignment: Default::default(),
        dn_no: "DN-1".into(),
        date: Utc::now(),
        vendor_id: ObjectId::new(),
        linked_bill_id: Some(ObjectId::new()),
        reason: DebitNoteReason::Return,
        currency: "INR".into(),
        exchange_rate: None,
        items: vec![line_item()],
        totals: totals(),
        refund_mode: RefundMode::Replacement,
        refund_txn_id: None,
        notes: None,
        attachments: vec![],
        status: DebitNoteStatus::Issued,
        lineage: vec![],
    };
    let json = serde_json::to_value(&dn).unwrap();
    assert_eq!(json.get("reason").and_then(|x| x.as_str()), Some("return"));
    assert_eq!(
        json.get("refundMode").and_then(|x| x.as_str()),
        Some("replacement")
    );
    let back: DebitNote = serde_json::from_value(json).unwrap();
    assert_eq!(back.reason, DebitNoteReason::Return);
    assert_eq!(back.refund_mode, RefundMode::Replacement);
}

#[test]
fn payout_receipt_apply_to_bills_round_trips() {
    let (identity, audit) = ids();
    let p = PayoutReceipt {
        identity,
        audit,
        assignment: Default::default(),
        payment_no: "PAY-1".into(),
        date: Utc::now(),
        vendor_id: ObjectId::new(),
        mode: PaymentMode::Neft,
        bank_account_id: ObjectId::new(),
        cheque_no: None,
        cheque_date: None,
        txn_id: Some("TXN-NEFT-001".into()),
        reference: Some("Q4 settlement".into()),
        amount: 100_000.0,
        currency: "INR".into(),
        exchange_rate: None,
        apply_to: vec![
            BillApplication {
                bill_id: ObjectId::new(),
                amount: 60_000.0,
            },
            BillApplication {
                bill_id: ObjectId::new(),
                amount: 35_000.0,
            },
        ],
        excess_as_advance: true,
        tds_deducted: Some(5_000.0),
        notes: None,
        attachments: vec![],
        status: PayoutStatus::Cleared,
        lineage: vec![],
    };
    let json = serde_json::to_value(&p).unwrap();
    assert_eq!(json.get("mode").and_then(|x| x.as_str()), Some("neft"));
    assert_eq!(json.get("status").and_then(|x| x.as_str()), Some("cleared"));
    assert_eq!(
        json.pointer("/applyTo/1/amount").and_then(|x| x.as_f64()),
        Some(35_000.0)
    );
    let back: PayoutReceipt = serde_json::from_value(json).unwrap();
    assert_eq!(back.apply_to.len(), 2);
    assert!(back.excess_as_advance);
}

#[test]
fn purchase_lead_stage_round_trips() {
    let (identity, audit) = ids();
    let l = PurchaseLead {
        identity,
        audit,
        assignment: Default::default(),
        title: "1000 sqft tile order".into(),
        vendor_candidate_id: Some(ObjectId::new()),
        category: Some("Tiles".into()),
        required_by: Some(Utc::now()),
        quantity: Some(1000.0),
        estimated_budget: Some(150_000.0),
        currency: Some("INR".into()),
        specs: Some("600×600 vitrified, polished, anti-skid".into()),
        attachments: vec![],
        stage: PurchaseLeadStage::QuotesReceived,
        awarded_vendor_id: None,
        linked_po_ids: vec![],
        lineage: vec![],
    };
    let json = serde_json::to_value(&l).unwrap();
    assert_eq!(
        json.get("stage").and_then(|x| x.as_str()),
        Some("quotes_received")
    );
    assert!(json.get("awardedVendorId").is_none(), "None should skip");
    let back: PurchaseLead = serde_json::from_value(json).unwrap();
    assert_eq!(back.stage, PurchaseLeadStage::QuotesReceived);
}
