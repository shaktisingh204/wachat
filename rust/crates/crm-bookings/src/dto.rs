//! Wire-format request DTOs for the booking endpoints.
//!
//! The **response** types for every read/write endpoint are the
//! canonical [`crm_extras_types::BookingResource`] /
//! [`crm_extras_types::Booking`] DTOs — we deliberately do not
//! redeclare them here. The shapes below describe only what callers
//! send IN; they are intentionally narrower than the full models so
//! the API surface stays controlled.
//!
//! Field naming uses `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use chrono::{DateTime, Utc};
use crm_extras_types::booking::{BookingResourceKind, BookingStatus, PaymentStatus, Reminder};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/* ====================================================================== */
/*  BookingResource DTOs                                                  */
/* ====================================================================== */

/// `GET /v1/crm/bookings/resources` query string.
///
/// `q` is a free-text substring searched (case-insensitive) on the
/// resource `name`. `kind` filters exactly to one of `room`,
/// `equipment`, or `staff`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResourcesQuery {
    /// 1-indexed page. Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text substring on `name`.
    #[serde(default)]
    pub q: Option<String>,
    /// Filter to a single resource kind (`room`, `equipment`, `staff`).
    #[serde(default)]
    pub kind: Option<BookingResourceKind>,
}

/// `POST /v1/crm/bookings/resources` body.
///
/// **Required:** `kind`, `name`, `capacity`.
///
/// **Optional:** `hourlyRate`, `currency`, `active`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookingResourceInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- descriptor (★ required) ----- */
    pub kind: BookingResourceKind,
    pub name: String,
    /// Maximum concurrent bookings the resource can absorb. `1` is the
    /// common "exclusive" case (a private staff calendar); higher
    /// values model shared resources.
    pub capacity: u32,

    /* ----- pricing ----- */
    #[serde(default)]
    pub hourly_rate: Option<f64>,
    /// ISO-4217 code. Free-form on the wire; not validated here.
    #[serde(default)]
    pub currency: Option<String>,

    /* ----- bookkeeping ----- */
    /// Defaults to `true` on create when absent.
    #[serde(default)]
    pub active: Option<bool>,
}

/// `PATCH /v1/crm/bookings/resources/:id` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookingResourceInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<BookingResourceKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hourly_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,
}

impl UpdateBookingResourceInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.kind.is_none()
            && self.name.is_none()
            && self.capacity.is_none()
            && self.hourly_rate.is_none()
            && self.currency.is_none()
            && self.active.is_none()
    }
}

/* ====================================================================== */
/*  Booking DTOs                                                          */
/* ====================================================================== */

/// `GET /v1/crm/bookings/bookings` query string. Filters compose with
/// AND; absent fields are unrestricted.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBookingsQuery {
    /// 1-indexed page. Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Restrict to a single resource (24-char hex `ObjectId`).
    #[serde(default)]
    pub resource_id: Option<String>,
    /// Restrict to a single customer (24-char hex `ObjectId`).
    #[serde(default)]
    pub customer_id: Option<String>,
    /// Restrict to a single lifecycle status.
    #[serde(default)]
    pub status: Option<BookingStatus>,
    /// Inclusive lower bound on `slotStart`.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub date_from: Option<DateTime<Utc>>,
    /// Exclusive upper bound on `slotStart`.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub date_to: Option<DateTime<Utc>>,
}

/// `POST /v1/crm/bookings/bookings` body. Curated subset of the full
/// [`crm_extras_types::Booking`] surface — enough to drive the
/// "Add Booking" UI.
///
/// **Required:** `resourceId`, `customerId`, `slotStart`, `slotEnd`.
///
/// **Optional:** `service`, `recurringRule`, `capacityUsed`,
/// `paymentStatus`, `cancellationPolicy`, `notes`.
///
/// **Server-managed:** `status` (defaults `pending` on insert),
/// `reminders[]`, `noShow`. These are not editable through create or
/// update; the lifecycle endpoints (`/check-in`, `/cancel`) are the
/// canonical writers.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookingInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId`.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- references (★ both required) ----- */
    /// 24-char hex of the parent [`BookingResource`].
    pub resource_id: String,
    /// 24-char hex of the customer holding the slot.
    pub customer_id: String,
    /// Free-form service label layered on top of the resource. Optional
    /// because some kinds (e.g. equipment rentals) don't need a service
    /// taxonomy.
    #[serde(default)]
    pub service: Option<String>,

    /* ----- slot (★ both required) ----- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_end: DateTime<Utc>,
    /// RFC 5545 RRULE string. Empty / `None` means a one-off booking.
    #[serde(default)]
    pub recurring_rule: Option<String>,
    /// How much of the resource's `capacity` this booking consumes.
    /// Defaults to `1` on insert when absent.
    #[serde(default)]
    pub capacity_used: Option<u32>,

    /* ----- payment + policy ----- */
    /// Defaults to `unpaid` on insert when absent.
    #[serde(default)]
    pub payment_status: Option<PaymentStatus>,
    #[serde(default)]
    pub cancellation_policy: Option<String>,

    /* ----- bag ----- */
    #[serde(default)]
    pub notes: Option<String>,
}

/// `PATCH /v1/crm/bookings/bookings/:id` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set. Lifecycle transitions (`status`, `noShow`,
/// `reminders[]`) belong to dedicated endpoints (e.g.
/// `POST /:id/check-in`, `POST /:id/cancel`) and are not editable here.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookingInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub slot_start: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub slot_end: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring_rule: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity_used: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_status: Option<PaymentStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancellation_policy: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// Replace the reminders array wholesale. The lifecycle endpoints
    /// stamp `sent` on individual reminders out-of-band; PATCH overwrites
    /// the array if the caller sends it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reminders: Option<Vec<Reminder>>,
}

impl UpdateBookingInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.resource_id.is_none()
            && self.customer_id.is_none()
            && self.service.is_none()
            && self.slot_start.is_none()
            && self.slot_end.is_none()
            && self.recurring_rule.is_none()
            && self.capacity_used.is_none()
            && self.payment_status.is_none()
            && self.cancellation_policy.is_none()
            && self.notes.is_none()
            && self.reminders.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    /* ----- resource DTO tests ----- */

    #[test]
    fn create_resource_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "kind": "room",
            "name": "Conference Room A",
            "capacity": 12,
            "hourlyRate": 500.0,
            "currency": "INR",
        });
        let input: CreateBookingResourceInput = serde_json::from_value(json).unwrap();
        assert!(matches!(input.kind, BookingResourceKind::Room));
        assert_eq!(input.name, "Conference Room A");
        assert_eq!(input.capacity, 12);
        assert_eq!(input.hourly_rate, Some(500.0));
        assert_eq!(input.currency.as_deref(), Some("INR"));
        assert!(input.active.is_none());
    }

    #[test]
    fn update_resource_input_is_empty_detects_all_unset() {
        let empty = UpdateBookingResourceInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateBookingResourceInput {
            name: Some("Renamed".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_resources_query_parses_kind_filter() {
        let q: ListResourcesQuery =
            serde_json::from_value(serde_json::json!({ "kind": "staff" })).unwrap();
        assert!(matches!(q.kind, Some(BookingResourceKind::Staff)));
    }

    /* ----- booking DTO tests ----- */

    #[test]
    fn create_booking_input_round_trips_camel_case() {
        let resource = ObjectId::new();
        let customer = ObjectId::new();
        let now = Utc::now();
        let json = serde_json::json!({
            "resourceId": resource.to_hex(),
            "customerId": customer.to_hex(),
            "service": "90-min consult",
            "slotStart": now,
            "slotEnd": now,
            "recurringRule": "FREQ=WEEKLY;BYDAY=MO",
            "capacityUsed": 1,
            "paymentStatus": "partial",
            "cancellationPolicy": "24h notice",
        });
        let input: CreateBookingInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.resource_id, resource.to_hex());
        assert_eq!(input.customer_id, customer.to_hex());
        assert_eq!(input.service.as_deref(), Some("90-min consult"));
        assert_eq!(input.capacity_used, Some(1));
        assert!(matches!(input.payment_status, Some(PaymentStatus::Partial)));
        assert_eq!(input.cancellation_policy.as_deref(), Some("24h notice"));
        assert_eq!(
            input.recurring_rule.as_deref(),
            Some("FREQ=WEEKLY;BYDAY=MO"),
        );
    }

    #[test]
    fn update_booking_input_is_empty_detects_all_unset() {
        let empty = UpdateBookingInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateBookingInput {
            cancellation_policy: Some("48h".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_bookings_query_defaults_are_none() {
        let q: ListBookingsQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.resource_id.is_none());
        assert!(q.customer_id.is_none());
        assert!(q.status.is_none());
        assert!(q.date_from.is_none());
        assert!(q.date_to.is_none());
    }

    #[test]
    fn list_bookings_query_parses_status_filter() {
        let q: ListBookingsQuery =
            serde_json::from_value(serde_json::json!({ "status": "no_show" })).unwrap();
        assert!(matches!(q.status, Some(BookingStatus::NoShow)));
    }
}
