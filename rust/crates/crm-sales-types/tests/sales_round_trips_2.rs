//! Integration round-trip tests for §1.6 / §1.7 / §1.8 / §1.9 DTOs.

use bson::oid::ObjectId;
use chrono::Utc;
use crm_core::{Audit, Identity};
use crm_sales_types::{
    BankDetails, CaptchaProvider, CreditNote, CreditNoteReason, CreditNoteStatus, EInvoiceEnvelope,
    FormField, FormFieldType, FormTheme, GstTreatment, Invoice, InvoiceApplication, InvoiceStatus,
    LeadForm, LineItem, PaymentMode, PaymentReceipt, Pipeline, PipelineVisibility, ReceiptStatus,
    RecurringConfig, RecurringFrequency, RefundMode, Stage, Totals,
};

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

fn line_item_invoice() -> LineItem {
    LineItem {
        item_id: Some(ObjectId::new()),
        description: Some("Consulting".into()),
        hsn_sac: Some("998314".into()),
        qty: 1.0,
        unit: Some("nos".into()),
        rate: 100_000.0,
        discount_pct: None,
        tax_rate_pct: Some(18.0),
        cgst_amount: Some(9_000.0),
        sgst_amount: Some(9_000.0),
        igst_amount: None,
        cess_amount: None,
        total: 118_000.0,
        warehouse_id: None,
        qty_pending: None,
        qty_delivered: None,
        qty_invoiced: None,
    }
}

fn totals_invoice() -> Totals {
    Totals {
        sub_total: 100_000.0,
        discount_overall: None,
        shipping_charge: None,
        adjustment: None,
        round_off: Some(0.0),
        total: 118_000.0,
    }
}

#[test]
fn invoice_serializes_e_invoice_recurring_and_payment_state() {
    let (identity, audit) = ids();
    let inv = Invoice {
        identity,
        audit,
        attribution: Default::default(),
        assignment: Default::default(),
        invoice_no: "INV-A0001".into(),
        date: Utc::now(),
        due_date: Utc::now(),
        client_id: ObjectId::new(),
        place_of_supply: Some("Karnataka".into()),
        reverse_charge: false,
        gst_treatment: GstTreatment::Registered,
        currency: "INR".into(),
        exchange_rate: None,
        billing_address: None,
        shipping_address: None,
        items: vec![line_item_invoice()],
        totals: totals_invoice(),
        tcs_pct: None,
        tds_pct: Some(10.0),
        amount_paid: 50_000.0,
        balance: 68_000.0,
        payment_terms: Some("Net 30".into()),
        bank_details: Some(BankDetails {
            bank_name: Some("HDFC".into()),
            ifsc: Some("HDFC0000001".into()),
            ..Default::default()
        }),
        upi_id: Some("acme@hdfc".into()),
        qr_image_file_id: None,
        customer_notes: None,
        terms_and_conditions: None,
        e_invoice: Some(EInvoiceEnvelope {
            irn: "abcd1234".repeat(8),
            qr_string: "<signed-qr-payload>".into(),
            ack_no: "112310099999999".into(),
            ack_date: Utc::now(),
        }),
        eway_bill_no: None,
        attachments: vec![],
        template_id: None,
        thumbnail_file_id: None,
        signature_image_file_id: None,
        pdf_status: Default::default(),
        email_log: vec![],
        whatsapp_send_log: vec![],
        recurring: Some(RecurringConfig {
            frequency: RecurringFrequency::Monthly,
            end_date: None,
            next_run: Utc::now(),
            remaining_runs: Some(11),
        }),
        status: InvoiceStatus::PartiallyPaid,
        lineage: vec![],
    };

    let json = serde_json::to_value(&inv).unwrap();
    // Cross-cutting fragments flatten.
    assert!(json.get("identity").is_none());
    assert!(json.get("_id").is_some());
    // GST treatment & status — snake_case for both.
    assert_eq!(
        json.get("gstTreatment").and_then(|v| v.as_str()),
        Some("registered")
    );
    assert_eq!(
        json.get("status").and_then(|v| v.as_str()),
        Some("partially_paid")
    );
    // E-invoice envelope is nested (not flattened).
    assert!(json.pointer("/eInvoice/irn").is_some());
    assert!(json.pointer("/eInvoice/qrString").is_some());
    // Recurring config is nested.
    assert_eq!(
        json.pointer("/recurring/frequency")
            .and_then(|v| v.as_str()),
        Some("monthly")
    );
    // Reverse-charge defaulted false → skip-serialize.
    assert!(json.get("reverseCharge").is_none());
    // Payment-state fields are present.
    assert_eq!(
        json.get("amountPaid").and_then(|v| v.as_f64()),
        Some(50_000.0)
    );
    assert_eq!(json.get("balance").and_then(|v| v.as_f64()), Some(68_000.0));

    let back: Invoice = serde_json::from_value(json).unwrap();
    assert_eq!(back.invoice_no, inv.invoice_no);
    assert_eq!(back.gst_treatment, GstTreatment::Registered);
    assert_eq!(back.status, InvoiceStatus::PartiallyPaid);
    assert!(back.e_invoice.is_some());
    assert_eq!(back.recurring.as_ref().unwrap().remaining_runs, Some(11));
}

#[test]
fn payment_receipt_apply_to_invoices_round_trips() {
    let (identity, audit) = ids();
    let inv1 = ObjectId::new();
    let inv2 = ObjectId::new();
    let r = PaymentReceipt {
        identity,
        audit,
        assignment: Default::default(),
        receipt_no: "PR-1".into(),
        date: Utc::now(),
        client_id: ObjectId::new(),
        mode: PaymentMode::Upi,
        bank_account_id: ObjectId::new(),
        cheque_no: None,
        cheque_date: None,
        txn_id: Some("TXN-9999".into()),
        reference: Some("Q3 retainer".into()),
        amount: 250_000.0,
        currency: "INR".into(),
        exchange_rate: None,
        apply_to: vec![
            InvoiceApplication {
                invoice_id: inv1,
                amount: 100_000.0,
            },
            InvoiceApplication {
                invoice_id: inv2,
                amount: 130_000.0,
            },
        ],
        excess_as_advance: true,
        tds_deducted: Some(20_000.0),
        bank_charges: None,
        notes: None,
        attachments: vec![],
        status: ReceiptStatus::Cleared,
        lineage: vec![],
    };

    let json = serde_json::to_value(&r).unwrap();
    assert_eq!(json.get("mode").and_then(|v| v.as_str()), Some("upi"));
    assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("cleared"));
    assert_eq!(
        json.pointer("/applyTo/0/amount").and_then(|v| v.as_f64()),
        Some(100_000.0)
    );
    assert_eq!(
        json.get("excessAsAdvance").and_then(|v| v.as_bool()),
        Some(true)
    );
    let back: PaymentReceipt = serde_json::from_value(json).unwrap();
    assert_eq!(back.apply_to.len(), 2);
    assert_eq!(back.mode, PaymentMode::Upi);
}

#[test]
fn credit_note_carries_reason_and_refund_mode() {
    let (identity, audit) = ids();
    let cn = CreditNote {
        identity,
        audit,
        assignment: Default::default(),
        cn_no: "CN-1".into(),
        date: Utc::now(),
        client_id: ObjectId::new(),
        linked_invoice_id: Some(ObjectId::new()),
        reason: CreditNoteReason::PriceAdjust,
        currency: "INR".into(),
        exchange_rate: None,
        items: vec![line_item_invoice()],
        totals: totals_invoice(),
        tax_recalc: true,
        refund_mode: RefundMode::Credit,
        refund_txn_id: None,
        notes: None,
        attachments: vec![],
        status: CreditNoteStatus::Issued,
        lineage: vec![],
    };

    let json = serde_json::to_value(&cn).unwrap();
    assert_eq!(
        json.get("reason").and_then(|v| v.as_str()),
        Some("price_adjust")
    );
    assert_eq!(
        json.get("refundMode").and_then(|v| v.as_str()),
        Some("credit")
    );
    assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("issued"));
    assert_eq!(json.get("taxRecalc").and_then(|v| v.as_bool()), Some(true));

    let back: CreditNote = serde_json::from_value(json).unwrap();
    assert_eq!(back.reason, CreditNoteReason::PriceAdjust);
    assert_eq!(back.refund_mode, RefundMode::Credit);
}

#[test]
fn pipeline_with_stages_and_lead_form_round_trip() {
    let (identity_p, audit_p) = ids();
    let stage_a = Stage {
        id: ObjectId::new(),
        label: "New".into(),
        color: Some("zinc-500".into()),
        probability_pct: Some(10),
        order: 0,
    };
    let stage_b = Stage {
        id: ObjectId::new(),
        label: "Won".into(),
        color: Some("emerald-500".into()),
        probability_pct: Some(100),
        order: 1,
    };
    let pipeline = Pipeline {
        identity: identity_p,
        audit: audit_p,
        name: "Outbound enterprise".into(),
        stages: vec![stage_a.clone(), stage_b.clone()],
        default_stage_id: stage_a.id,
        win_loss_reasons: vec!["price".into(), "timing".into()],
        owner_id: ObjectId::new(),
        visibility: PipelineVisibility::Team,
    };
    let json = serde_json::to_value(&pipeline).unwrap();
    assert_eq!(
        json.get("visibility").and_then(|v| v.as_str()),
        Some("team")
    );
    assert_eq!(
        json.pointer("/stages/0/label").and_then(|v| v.as_str()),
        Some("New")
    );
    let back: Pipeline = serde_json::from_value(json).unwrap();
    assert_eq!(back.stages.len(), 2);
    assert_eq!(back.default_stage_id, stage_a.id);

    let (identity_f, audit_f) = ids();
    let form = LeadForm {
        identity: identity_f,
        audit: audit_f,
        label: "Contact us".into(),
        fields: vec![
            FormField {
                key: "email".into(),
                label: "Email".into(),
                field_type: FormFieldType::Email,
                required: true,
                options: vec![],
                placeholder: Some("you@example.com".into()),
                help_text: None,
            },
            FormField {
                key: "industry".into(),
                label: "Industry".into(),
                field_type: FormFieldType::Select,
                required: false,
                options: vec!["SaaS".into(), "Retail".into()],
                placeholder: None,
                help_text: None,
            },
        ],
        theme: FormTheme {
            brand_color: Some("#22c55e".into()),
            mode: Some("light".into()),
            ..Default::default()
        },
        redirect_url: Some("https://acme.example/thanks".into()),
        captcha: CaptchaProvider::Turnstile,
        submit_webhook: Some("https://hooks.example.com/lead".into()),
        default_pipeline_id: Some(pipeline.identity.id),
        default_stage_id: Some(stage_a.id),
        published: true,
    };
    let json = serde_json::to_value(&form).unwrap();
    assert_eq!(
        json.get("captcha").and_then(|v| v.as_str()),
        Some("turnstile")
    );
    assert_eq!(
        json.pointer("/fields/0/fieldType").and_then(|v| v.as_str()),
        Some("email")
    );
    // `published = true` is the default → skip-serialized.
    assert!(json.get("published").is_none());
    let back: LeadForm = serde_json::from_value(json).unwrap();
    assert_eq!(back.fields.len(), 2);
    assert_eq!(back.captcha, CaptchaProvider::Turnstile);
    assert!(back.published, "missing field should default to true");
}
