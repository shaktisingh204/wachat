//! §12.9 Knowledge Base & FAQ.
//!
//! Mongo collection: `crm_kb_articles`. The struct flattens the
//! `crm-core` cross-cutting fragments (`Identity`, `Audit`) so the
//! document root carries §0 ownership / audit fields directly.
//!
//! `KbArticle` covers a single help-center entry: category + slug +
//! title + body, tags, draft/published/archived workflow, public /
//! portal / internal visibility, helpful + view counters, related
//! cross-links, last-reviewed timestamp, owner.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Editorial state. Articles start `Draft`, ship `Published`, and
/// retire to `Archived` (soft-hide; the row is kept for analytics + URL
/// permanence).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KbStatus {
    #[default]
    Draft,
    Published,
    Archived,
}

/// Audience scope:
/// - `Public` — anonymous web (the marketing-side help center).
/// - `Portal` — authenticated customer portal.
/// - `Internal` — staff-only runbooks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KbVisibility {
    #[default]
    Public,
    Portal,
    Internal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KbArticle {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- routing ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// URL slug — unique within `(projectId, visibility)`. The router
    /// resolves `/help/<slug>` (public) or `/portal/help/<slug>`.
    pub slug: String,

    /* ----- body --------------------------------------------------- */
    pub title: String,
    /// HTML or markdown — the rendering pipeline decides per article
    /// (a `format` discriminator can be added later as a new field
    /// without breaking existing docs).
    pub body: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /* ----- workflow + audience ----------------------------------- */
    #[serde(default)]
    pub status: KbStatus,
    #[serde(default)]
    pub visibility: KbVisibility,

    /* ----- engagement counters ----------------------------------- */
    #[serde(default)]
    pub helpful_count: u32,
    #[serde(default)]
    pub not_helpful_count: u32,
    /// View count is `u64` because high-traffic public articles can
    /// outgrow `u32` on long-running tenants.
    #[serde(default)]
    pub view_count: u64,

    /* ----- cross-links + ownership ------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_article_ids: Vec<ObjectId>,
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional", skip_serializing_if = "Option::is_none")]
    pub last_reviewed_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
}

/* =============================================================== */
/* KbCategory — tree node for the help-center taxonomy             */
/* =============================================================== */

/// One node in the KB category tree. Categories nest via `parent_id`
/// (Mongo adjacency list). `order` controls sibling sort. `slug` is
/// unique within `(projectId, parentId)` so URLs stay stable when the
/// tree is reshuffled. Mongo collection: `crm_kb_categories`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KbCategory {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- routing ----------------------------------------------- */
    pub name: String,
    pub slug: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /* ----- tree shape -------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,
    #[serde(default)]
    pub order: i32,

    /* ----- audience + workflow ----------------------------------- */
    #[serde(default)]
    pub visibility: KbVisibility,
    #[serde(default)]
    pub article_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crm_core::Audit as CoreAudit;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn kb_article_round_trips_with_flattened_fragments() {
        let a = KbArticle {
            identity: ident(),
            audit: CoreAudit::new(None),
            category: Some("billing".to_string()),
            slug: "how-to-update-card".to_string(),
            title: "How to update your card".to_string(),
            body: "<p>Open settings…</p>".to_string(),
            tags: vec!["billing".to_string(), "card".to_string()],
            status: KbStatus::Published,
            visibility: KbVisibility::Portal,
            helpful_count: 12,
            not_helpful_count: 1,
            view_count: 4321,
            related_article_ids: vec![ObjectId::new()],
            last_reviewed_at: Some(Utc::now()),
            owner_id: Some(ObjectId::new()),
        };

        let json = serde_json::to_value(&a).unwrap();

        // Flattened fragments live at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        // No nested fragment keys.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields + lowercase enums.
        assert_eq!(
            json.get("slug").and_then(|v| v.as_str()),
            Some("how-to-update-card")
        );
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("published"));
        assert_eq!(json.get("visibility").and_then(|v| v.as_str()), Some("portal"));
        assert_eq!(json.get("helpfulCount").and_then(|v| v.as_u64()), Some(12));
        assert_eq!(json.get("viewCount").and_then(|v| v.as_u64()), Some(4321));
        assert!(json.get("lastReviewedAt").is_some());
        assert!(json.get("relatedArticleIds").is_some());

        let back: KbArticle = serde_json::from_value(json).unwrap();
        assert_eq!(back.title, "How to update your card");
        assert!(matches!(back.status, KbStatus::Published));
        assert!(matches!(back.visibility, KbVisibility::Portal));
        assert_eq!(back.view_count, 4321);
    }

    #[test]
    fn kb_category_round_trips_with_flattened_fragments() {
        let c = KbCategory {
            identity: ident(),
            audit: CoreAudit::new(None),
            name: "Billing".to_string(),
            slug: "billing".to_string(),
            description: Some("Invoices, refunds, and pricing.".to_string()),
            icon: Some("CreditCard".to_string()),
            parent_id: None,
            order: 0,
            visibility: KbVisibility::Portal,
            article_count: 7,
        };

        let json = serde_json::to_value(&c).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        assert_eq!(json.get("slug").and_then(|v| v.as_str()), Some("billing"));
        assert_eq!(json.get("visibility").and_then(|v| v.as_str()), Some("portal"));
        assert_eq!(json.get("articleCount").and_then(|v| v.as_u64()), Some(7));

        let back: KbCategory = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Billing");
        assert!(matches!(back.visibility, KbVisibility::Portal));
    }
}
