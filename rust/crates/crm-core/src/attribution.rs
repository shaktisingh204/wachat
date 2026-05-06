//! `source`, `referrerId`, `campaignId`, `utm{...}` — first-party + ad
//! attribution carried on every revenue-bearing document so reports can
//! roll up acquisition cost without re-joining tables.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Utm {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub medium: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub campaign: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub term: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

impl Utm {
    pub fn is_empty(&self) -> bool {
        self.source.is_none()
            && self.medium.is_none()
            && self.campaign.is_none()
            && self.term.is_none()
            && self.content.is_none()
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attribution {
    /// Free-text first-party source ("Website", "Referral", "Cold Call",
    /// "Partner", …). Mirrors the existing TS `source` string vocab in
    /// `crm-leads.actions.ts`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub referrer_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub campaign_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Utm::is_empty")]
    pub utm: Utm,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_utm_is_skipped() {
        let a = Attribution::default();
        let json = serde_json::to_value(&a).unwrap();
        assert!(json.get("utm").is_none());
        assert!(json.get("source").is_none());
    }

    #[test]
    fn populated_utm_round_trips() {
        let a = Attribution {
            source: Some("Website".into()),
            utm: Utm {
                source: Some("google".into()),
                medium: Some("cpc".into()),
                ..Default::default()
            },
            ..Default::default()
        };
        let json = serde_json::to_value(&a).unwrap();
        assert_eq!(json.get("source").and_then(|v| v.as_str()), Some("Website"));
        assert_eq!(
            json.pointer("/utm/source").and_then(|v| v.as_str()),
            Some("google")
        );
    }
}
