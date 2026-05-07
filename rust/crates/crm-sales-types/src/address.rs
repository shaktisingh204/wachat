//! Postal address shape used by every sales document (client billing /
//! shipping, quotation/SO/invoice billing+shipping, delivery challan
//! ship-to). Promoted out of `client.rs` so all §1 entities can reuse
//! it without circular imports.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Address {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line1: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line2: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pincode: Option<String>,
    /// Optional human label for shipping addresses ("Office",
    /// "Warehouse-A", …). Ignored on billing addresses.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}
