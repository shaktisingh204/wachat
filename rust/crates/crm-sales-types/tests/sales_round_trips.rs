//! Integration round-trip tests for §1.2 / §1.3 / §1.4 / §1.5 DTOs.
//! Verify that:
//!   1. crm-core fragments flatten to the document root (no nested
//!      "identity" / "audit" wrappers).
//!   2. camelCase field naming matches the TS shape.
//!   3. Optional fields with default values skip-serialize.
//!   4. Status enums serialize lowercase and round-trip through JSON.

use bson::oid::ObjectId;
use chrono::Utc;
use crm_core::{Audit, Identity, LineageRef};
use crm_sales_types::{
    Address, ChallanLineItem, ChallanReason, DeliveryChallan, DeliveryChallanStatus,
    DeliveryMethod, LineItem, ModeOfTransport, ProformaInvoice, ProformaStatus, Quotation,
    QuotationStatus, SalesOrder, SalesOrderStatus, Totals,
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

fn sample_line_item() -> LineItem {
    LineItem {
        item_id: Some(ObjectId::new()),
        description: Some("Implementation services".into()),
        hsn_sac: Some("998314".into()),
        qty: 10.0,
        unit: Some("hrs".into()),
        rate: 5_000.0,
        discount_pct: Some(5.0),
        tax_rate_pct: Some(18.0),
        cgst_amount: Some(4_275.0),
        sgst_amount: Some(4_275.0),
        igst_amount: None,
        cess_amount: None,
        total: 56_050.0,
        warehouse_id: None,
        qty_pending: None,
        qty_delivered: None,
        qty_invoiced: None,
    }
}

fn sample_totals() -> Totals {
    Totals {
        sub_total: 47_500.0,
        discount_overall: None,
        shipping_charge: None,
        adjustment: None,
        round_off: Some(0.0),
        total: 56_050.0,
    }
}

#[test]
fn quotation_flattens_fragments_and_uses_camel_case() {
    let (identity, audit) = ids();
    let q = Quotation {
        identity,
        audit,
        attribution: Default::default(),
        assignment: Default::default(),
        quotation_no: "QT-A0001".into(),
        date: Utc::now(),
        valid_until: Utc::now(),
        client_id: ObjectId::new(),
        reference_no: None,
        sales_agent_id: None,
        deal_id: None,
        subject: Some("Q3 implementation".into()),
        currency: "INR".into(),
        exchange_rate: None,
        place_of_supply: Some("Karnataka".into()),
        billing_address: Some(Address {
            city: Some("Bengaluru".into()),
            ..Default::default()
        }),
        shipping_address: None,
        items: vec![sample_line_item()],
        totals: sample_totals(),
        terms_and_conditions: None,
        customer_notes: None,
        attachments: vec![],
        signature_image_file_id: None,
        template_id: None,
        thumbnail_file_id: None,
        pdf_status: Default::default(),
        email_log: vec![],
        whatsapp_send_log: vec![],
        status: QuotationStatus::Sent,
        converted_to: vec![],
        lineage: vec![],
        revision_history: vec![],
    };

    let json = serde_json::to_value(&q).unwrap();

    // Identity + Audit flattened to root.
    assert!(json.get("identity").is_none());
    assert!(json.get("audit").is_none());
    assert!(json.get("_id").is_some());
    assert!(json.get("projectId").is_some());
    assert!(json.get("userId").is_some());
    assert!(json.get("createdAt").is_some());

    // camelCase domain fields.
    assert!(json.get("quotationNo").is_some());
    assert!(json.get("validUntil").is_some());
    assert!(json.get("clientId").is_some());
    assert!(json.get("placeOfSupply").is_some());
    assert!(json.get("billingAddress").is_some());

    // Status lowercase.
    assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("sent"));

    // Empty optional collections skip.
    assert!(json.get("emailLog").is_none());
    assert!(json.get("attachments").is_none());

    // Round-trip.
    let back: Quotation = serde_json::from_value(json).unwrap();
    assert_eq!(back.quotation_no, q.quotation_no);
    assert_eq!(back.items.len(), 1);
    assert_eq!(back.items[0].qty, 10.0);
}

#[test]
fn proforma_carries_advance_fields_and_linked_so() {
    let (identity, audit) = ids();
    let so_id = ObjectId::new();
    let p = ProformaInvoice {
        identity,
        audit,
        attribution: Default::default(),
        assignment: Default::default(),
        proforma_no: "PI-1".into(),
        date: Utc::now(),
        valid_until: Utc::now(),
        client_id: ObjectId::new(),
        linked_so_id: Some(so_id),
        reference_no: None,
        sales_agent_id: None,
        deal_id: None,
        subject: None,
        currency: "INR".into(),
        exchange_rate: None,
        place_of_supply: None,
        billing_address: None,
        shipping_address: None,
        items: vec![sample_line_item()],
        totals: sample_totals(),
        advance_pct: Some(30.0),
        advance_amount: Some(16_815.0),
        expected_delivery: None,
        payment_due_date: Some(Utc::now()),
        terms_and_conditions: None,
        customer_notes: None,
        attachments: vec![],
        signature_image_file_id: None,
        template_id: None,
        thumbnail_file_id: None,
        pdf_status: Default::default(),
        email_log: vec![],
        whatsapp_send_log: vec![],
        status: ProformaStatus::Sent,
        converted_to: vec![],
        lineage: vec![LineageRef::new("salesOrder", so_id)],
    };

    let json = serde_json::to_value(&p).unwrap();
    assert_eq!(
        json.get("status").and_then(|v| v.as_str()),
        Some("sent"),
        "ProformaStatus should serialize lowercase"
    );
    assert!(json.get("advancePct").is_some());
    assert!(json.get("advanceAmount").is_some());
    assert!(json.get("linkedSoId").is_some());
    assert_eq!(
        json.pointer("/lineage/0/kind").and_then(|v| v.as_str()),
        Some("salesOrder")
    );

    let back: ProformaInvoice = serde_json::from_value(json).unwrap();
    assert_eq!(back.advance_pct, Some(30.0));
    assert_eq!(back.linked_so_id, Some(so_id));
}

#[test]
fn sales_order_carries_fulfillment_fields_on_line_items() {
    let (identity, audit) = ids();
    let mut li = sample_line_item();
    li.warehouse_id = Some(ObjectId::new());
    li.qty_pending = Some(10.0);
    li.qty_delivered = Some(0.0);
    li.qty_invoiced = Some(0.0);

    let so = SalesOrder {
        identity,
        audit,
        attribution: Default::default(),
        assignment: Default::default(),
        so_no: "SO-1".into(),
        date: Utc::now(),
        client_id: ObjectId::new(),
        quotation_ref: Some(ObjectId::new()),
        po_no: Some("CUST-PO-9921".into()),
        po_date: Some(Utc::now()),
        expected_shipment_date: Some(Utc::now()),
        delivery_method: Some(DeliveryMethod::Courier),
        payment_terms: Some("Net 30".into()),
        shipping_address: None,
        currency: "INR".into(),
        exchange_rate: None,
        items: vec![li],
        totals: sample_totals(),
        customer_notes: None,
        internal_notes: Some("Rush — VIP".into()),
        attachments: vec![],
        status: SalesOrderStatus::Open,
        linked_delivery_ids: vec![],
        linked_invoice_ids: vec![],
        lineage: vec![],
    };

    let json = serde_json::to_value(&so).unwrap();
    assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("open"));
    assert_eq!(
        json.get("deliveryMethod").and_then(|v| v.as_str()),
        Some("courier"),
        "DeliveryMethod should serialize snake_case lowercase"
    );
    assert!(json.pointer("/items/0/warehouseId").is_some());
    assert_eq!(
        json.pointer("/items/0/qtyPending").and_then(|v| v.as_f64()),
        Some(10.0)
    );

    let back: SalesOrder = serde_json::from_value(json).unwrap();
    assert_eq!(back.so_no, so.so_no);
    assert_eq!(back.items[0].qty_pending, Some(10.0));
    assert_eq!(back.delivery_method, Some(DeliveryMethod::Courier));
}

#[test]
fn delivery_challan_uses_dedicated_line_item_shape() {
    let (identity, audit) = ids();
    let cli = ChallanLineItem {
        item_id: ObjectId::new(),
        description: Some("Industrial pump 5HP".into()),
        qty: 2.0,
        unit: Some("nos".into()),
        batch: Some("B-2026-04".into()),
        expiry: None,
        serial_nos: vec!["SN-001".into(), "SN-002".into()],
    };
    let dc = DeliveryChallan {
        identity,
        audit,
        assignment: Default::default(),
        challan_no: "DC-1".into(),
        date: Utc::now(),
        so_ref: Some(ObjectId::new()),
        client_id: ObjectId::new(),
        vehicle_no: Some("KA-01-AB-1234".into()),
        driver_name: Some("Ravi".into()),
        driver_phone: Some("+91 9999900000".into()),
        transporter: Some("BlueDart".into()),
        lr_no: Some("LR-ABC-99".into()),
        lr_date: Some(Utc::now()),
        mode_of_transport: ModeOfTransport::Road,
        eway_bill_no: Some("EWB-12345".into()),
        items: vec![cli],
        dispatch_warehouse_id: ObjectId::new(),
        ship_to_address: Address {
            line1: Some("Plant 2, Industrial Area".into()),
            city: Some("Pune".into()),
            state: Some("Maharashtra".into()),
            country: Some("India".into()),
            pincode: Some("411019".into()),
            ..Default::default()
        },
        reason_for_transport: ChallanReason::Sale,
        reason_note: None,
        attachments: vec![],
        status: DeliveryChallanStatus::Dispatched,
        lineage: vec![],
    };

    let json = serde_json::to_value(&dc).unwrap();
    assert_eq!(
        json.get("status").and_then(|v| v.as_str()),
        Some("dispatched")
    );
    assert_eq!(
        json.get("modeOfTransport").and_then(|v| v.as_str()),
        Some("road")
    );
    assert_eq!(
        json.get("reasonForTransport").and_then(|v| v.as_str()),
        Some("sale")
    );
    assert!(json.get("ewayBillNo").is_some());
    assert_eq!(
        json.pointer("/items/0/serialNos/1")
            .and_then(|v| v.as_str()),
        Some("SN-002")
    );
    assert!(json.get("dispatchWarehouseId").is_some());
    assert!(json.get("shipToAddress").is_some());

    let back: DeliveryChallan = serde_json::from_value(json).unwrap();
    assert_eq!(back.challan_no, dc.challan_no);
    assert_eq!(back.items[0].serial_nos.len(), 2);
    assert_eq!(back.reason_for_transport, ChallanReason::Sale);
}
