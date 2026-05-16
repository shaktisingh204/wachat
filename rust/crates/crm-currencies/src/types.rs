//! On-disk shape of a `crm_currencies` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCurrency {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// 3-letter ISO 4217 code, e.g. `"INR"`, `"USD"`. Stored uppercase.
    /// Unique per tenant among non-archived rows.
    pub code: String,

    /// Full display name, e.g. `"Indian Rupee"`.
    pub name: String,

    /// Currency symbol, e.g. `"₹"`, `"$"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,

    /// Number of fractional digits to display (typically 2; JPY uses 0).
    #[serde(default = "default_decimal_places")]
    pub decimal_places: i32,

    /// Rate vs the tenant's base currency. `1.0` for the base itself.
    #[serde(default = "default_exchange_rate")]
    pub exchange_rate: f64,

    /// Exactly one currency per tenant should have `isBase = true`.
    /// Enforced softly by demoting siblings on create/update.
    #[serde(default)]
    pub is_base: bool,

    /// `"prefix"` (e.g. `$10.00`) or `"suffix"` (e.g. `10.00 €`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_format: Option<String>,

    /// Thousand grouping separator, e.g. `","` or `" "`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thousand_separator: Option<String>,

    /// Decimal mark, e.g. `"."` or `","`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decimal_separator: Option<String>,

    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Timestamp of the most recent `exchangeRate` write.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<BsonDateTime>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}

fn default_decimal_places() -> i32 {
    2
}

fn default_exchange_rate() -> f64 {
    1.0
}
