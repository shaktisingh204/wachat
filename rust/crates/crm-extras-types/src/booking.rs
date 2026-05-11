//! §12.12 Bookings.
//!
//! Two top-level entities live in this module:
//! - `BookingResource` (Mongo collection `crm_booking_resources`) — a
//!   bookable thing (room, equipment, staff member). Carries the
//!   capacity ceiling and the optional hourly rate the booking flow
//!   uses to price slots.
//! - `Booking` (Mongo collection `crm_bookings`) — one customer-held
//!   slot against a `BookingResource`. Supports recurring rules,
//!   capacity-shared slots, multi-channel reminders, payment status,
//!   cancellation policy, and a no-show flag.
//!
//! Each struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================== */
/*  Booking resource                                               */
/* ============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookingResourceKind {
    #[default]
    Room,
    Equipment,
    Staff,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookingResource {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- descriptor ------------------------------------------- */
    pub kind: BookingResourceKind,
    pub name: String,
    /// Maximum concurrent bookings the resource can absorb. `1` is the
    /// common "exclusive" case (a private staff calendar); higher
    /// values model shared resources (a 12-seat conference room sold
    /// per-seat).
    pub capacity: u32,

    /* ----- pricing ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hourly_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /* ----- bookkeeping ------------------------------------------ */
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub active: bool,
}

/* ============================================================== */
/*  Booking                                                        */
/* ============================================================== */

/// Booking lifecycle. Multi-word variants serialize as `snake_case`
/// (`no_show`) to match the §0 enum convention; single-word variants
/// stay lowercase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BookingStatus {
    #[default]
    Pending,
    Confirmed,
    Cancelled,
    Completed,
    NoShow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    #[default]
    Unpaid,
    Partial,
    Paid,
    Refunded,
}

/// One scheduled reminder for the booking. `channel` is free-form
/// (`email`, `sms`, `whatsapp`, `push`, …) so the integrator can wire
/// new channels without churning this DTO crate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub channel: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub sent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Booking {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- references ------------------------------------------- */
    pub resource_id: ObjectId,
    /// Free-form service label ("90-minute consult", "Massage") layered
    /// on top of the resource. Optional because some resource kinds
    /// (e.g. equipment rentals) don't need a service taxonomy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    pub customer_id: ObjectId,

    /* ----- slot ------------------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_end: DateTime<Utc>,
    /// RFC 5545 RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO,WE`). Empty /
    /// `None` means a one-off booking.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring_rule: Option<String>,
    /// How much of the resource's `capacity` this booking consumes.
    pub capacity_used: u32,

    /* ----- payment + reminders ---------------------------------- */
    #[serde(default)]
    pub payment_status: PaymentStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reminders: Vec<Reminder>,

    /* ----- policy ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancellation_policy: Option<String>,

    /* ----- workflow --------------------------------------------- */
    #[serde(default, skip_serializing_if = "is_false")]
    pub no_show: bool,
    #[serde(default)]
    pub status: BookingStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/* ============================================================== */
/*  Helpers                                                        */
/* ============================================================== */

fn default_true() -> bool {
    true
}

fn is_true(b: &bool) -> bool {
    *b
}

fn is_false(b: &bool) -> bool {
    !*b
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn booking_resource_round_trips_with_flattened_fragments() {
        let resource = BookingResource {
            identity: identity(),
            audit: audit(),
            kind: BookingResourceKind::Room,
            name: "Conference Room A".to_string(),
            capacity: 12,
            hourly_rate: Some(500.0),
            currency: Some("INR".to_string()),
            active: true,
        };

        let json = serde_json::to_value(&resource).unwrap();

        // Flattened crm-core fragments live at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // Nested fragment keys must NOT exist.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // Entity-specific camelCase fields.
        assert!(json.get("hourlyRate").is_some());
        // Enum serializes lowercase.
        assert_eq!(json.get("kind").unwrap(), "room");
        // Default-true `active` skip-serializes (it's the default).
        assert!(json.get("active").is_none());

        let back: BookingResource = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Conference Room A");
        assert!(matches!(back.kind, BookingResourceKind::Room));
        assert!(back.active);
    }

    #[test]
    fn booking_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let booking = Booking {
            identity: identity(),
            audit: audit(),
            resource_id: ObjectId::new(),
            service: Some("90-min consult".to_string()),
            customer_id: ObjectId::new(),
            slot_start: now,
            slot_end: now,
            recurring_rule: Some("FREQ=WEEKLY;BYDAY=MO".to_string()),
            capacity_used: 1,
            payment_status: PaymentStatus::Partial,
            reminders: vec![Reminder {
                at: now,
                channel: "email".to_string(),
                sent: false,
            }],
            cancellation_policy: Some("24h notice".to_string()),
            no_show: false,
            status: BookingStatus::Confirmed,
            notes: None,
        };

        let json = serde_json::to_value(&booking).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("resourceId").is_some());
        assert!(json.get("customerId").is_some());
        assert!(json.get("slotStart").is_some());
        assert!(json.get("slotEnd").is_some());
        assert!(json.get("recurringRule").is_some());
        assert!(json.get("capacityUsed").is_some());
        assert!(json.get("paymentStatus").is_some());
        assert!(json.get("cancellationPolicy").is_some());
        // Default false bools are skipped.
        assert!(json.get("noShow").is_none());
        // Status serializes lowercase (single-word variant).
        assert_eq!(json.get("status").unwrap(), "confirmed");
        assert_eq!(json.get("paymentStatus").unwrap(), "partial");

        let back: Booking = serde_json::from_value(json).unwrap();
        assert_eq!(back.capacity_used, 1);
        assert!(matches!(back.status, BookingStatus::Confirmed));
        assert!(matches!(back.payment_status, PaymentStatus::Partial));
        assert_eq!(back.reminders.len(), 1);
        assert!(!back.no_show);
    }
}
