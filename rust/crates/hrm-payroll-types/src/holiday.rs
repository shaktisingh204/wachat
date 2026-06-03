//! §9.5 Holidays.
//!
//! Mongo collection: `crm_holidays`. The struct flattens the `crm-core`
//! cross-cutting fragments (`Identity`, `Audit`) so the document root
//! carries the §0 ownership / audit fields directly.
//!
//! A `Holiday` represents one calendar entry in the project's holiday
//! list — date, name, classification (national / regional / religious /
//! optional / restricted), recurring flag, the locations the holiday
//! applies to (free-text region / branch identifiers), and optional
//! notes.

use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

/// Classification of a holiday. Drives downstream behaviour such as
/// whether the day is a default off-day for everyone (`National`),
/// only off for specific branches (`Regional`), tied to a religion
/// observance (`Religious`), or applied per-employee election
/// (`Optional` / `Restricted`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HolidayType {
    #[default]
    National,
    Regional,
    Religious,
    Optional,
    Restricted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Holiday {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- entity fields ----------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    pub name: String,

    #[serde(default)]
    pub holiday_type: HolidayType,

    /// Whether this holiday repeats every year on the same date.
    /// Defaults to `false` and skip-serializes when default.
    #[serde(default, skip_serializing_if = "is_false")]
    pub recurring: bool,

    /// Free-text region / branch identifiers the holiday applies to.
    /// Empty `Vec` means it applies project-wide.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_locations: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    fn fresh_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn holiday_round_trips_with_regional_type() {
        let h = Holiday {
            identity: fresh_identity(),
            audit: Audit::new(None),
            date: Utc::now(),
            name: "Maharashtra Day".to_string(),
            holiday_type: HolidayType::Regional,
            recurring: true,
            applicable_locations: vec!["mumbai".to_string(), "pune".to_string()],
            notes: Some("Public holiday in Maharashtra branches.".to_string()),
        };

        let json = serde_json::to_value(&h).unwrap();

        // Flattened §0 fragments live at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // HolidayType serializes lowercase.
        assert_eq!(
            json.get("holidayType").and_then(|v| v.as_str()),
            Some("regional"),
        );

        // camelCase + array field appear at root.
        assert_eq!(
            json.get("name").and_then(|v| v.as_str()),
            Some("Maharashtra Day")
        );
        assert!(json.get("applicableLocations").is_some());
        assert_eq!(json.get("recurring").and_then(|v| v.as_bool()), Some(true));

        let back: Holiday = serde_json::from_value(json).unwrap();
        assert_eq!(back.holiday_type, HolidayType::Regional);
        assert_eq!(back.applicable_locations.len(), 2);
        assert!(back.recurring);
        assert_eq!(back.name, "Maharashtra Day");
    }
}
