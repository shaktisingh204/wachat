//! DLT registry loader + 60s per-workspace cache (V2.8).
//!
//! The Next.js side owns the CRUD (direct Mongo writes into
//! `sabsms_dlt_*`) and calls `POST /v1/internal/dlt/invalidate` after
//! every write; the engine only reads. Cache pattern mirrors
//! `creds.rs` / `otp::store`.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mongodb::bson::{doc, Document};
use once_cell::sync::Lazy;
use tokio::sync::RwLock;

use crate::{db, state::AppState};

use super::dlt::{DltCategory, DltChain, DltHeader, DltTemplate};

const CACHE_TTL: Duration = Duration::from_secs(60);

/// Everything DLT a workspace has registered, loaded in one pass.
#[derive(Clone, Debug, Default)]
pub struct DltRegistry {
    /// ACTIVE templates only (status != "inactive").
    pub templates: Vec<DltTemplate>,
    pub headers: Vec<DltHeader>,
    pub chain: Option<DltChain>,
    /// True when the workspace has ANY dlt doc at all (incl. inactive) —
    /// distinguishes "not configured" from "configured but no match".
    pub configured: bool,
}

impl DltRegistry {
    /// Case-insensitive header lookup by the sender string.
    pub fn find_header(&self, header: &str) -> Option<&DltHeader> {
        self.headers
            .iter()
            .find(|h| h.header.eq_ignore_ascii_case(header))
    }

    pub fn find_template(&self, template_id: &str) -> Option<&DltTemplate> {
        self.templates.iter().find(|t| t.template_id == template_id)
    }
}

/// One cache slot: insertion instant + the shared registry snapshot.
type CacheEntry = (Instant, Arc<DltRegistry>);

/// 60s-TTL registry cache, keyed by workspaceId (creds.rs pattern).
static REGISTRY_CACHE: Lazy<RwLock<HashMap<String, CacheEntry>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

fn template_from_doc(d: &Document) -> Option<DltTemplate> {
    let template_id = d.get_str("templateId").ok()?.trim();
    if template_id.is_empty() {
        return None;
    }
    let category = DltCategory::parse(d.get_str("category").unwrap_or(""))?;
    let header_ids = d
        .get_array("headerIds")
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();
    Some(DltTemplate {
        template_id: template_id.to_string(),
        header_ids,
        category,
        body: d.get_str("body").unwrap_or("").to_string(),
        pe_id: d.get_str("peId").unwrap_or("").to_string(),
    })
}

fn header_from_doc(d: &Document) -> Option<DltHeader> {
    let header = d.get_str("header").ok()?.trim();
    if header.is_empty() {
        return None;
    }
    Some(DltHeader {
        header_id: d.get_str("headerId").unwrap_or("").to_string(),
        header: header.to_string(),
        category: DltCategory::parse(d.get_str("category").unwrap_or(""))
            .unwrap_or(DltCategory::Transactional),
    })
}

fn chain_from_doc(d: &Document) -> Option<DltChain> {
    let pe_id = d.get_str("peId").ok()?.trim();
    if pe_id.is_empty() {
        return None;
    }
    Some(DltChain {
        pe_id: pe_id.to_string(),
        tm_ids: d
            .get_array("tmIds")
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default(),
    })
}

async fn load_uncached(state: &Arc<AppState>, workspace_id: &str) -> DltRegistry {
    let mut reg = DltRegistry::default();

    let templates_col = state.mongo.collection::<Document>(db::COL_DLT_TEMPLATES);
    match templates_col
        .find(doc! { "workspaceId": workspace_id })
        .await
    {
        Ok(cursor) => {
            let docs = collect_docs(cursor).await;
            for d in &docs {
                reg.configured = true;
                let inactive = d.get_str("status").map(|s| s == "inactive").unwrap_or(false);
                if inactive {
                    continue;
                }
                if let Some(t) = template_from_doc(d) {
                    reg.templates.push(t);
                }
            }
        }
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "dlt template load failed");
        }
    }

    let headers_col = state.mongo.collection::<Document>(db::COL_DLT_HEADERS);
    match headers_col.find(doc! { "workspaceId": workspace_id }).await {
        Ok(cursor) => {
            let docs = collect_docs(cursor).await;
            for d in &docs {
                reg.configured = true;
                if let Some(h) = header_from_doc(d) {
                    reg.headers.push(h);
                }
            }
        }
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "dlt header load failed");
        }
    }

    let chains_col = state.mongo.collection::<Document>(db::COL_DLT_CHAINS);
    match chains_col
        .find_one(doc! { "workspaceId": workspace_id })
        .await
    {
        Ok(Some(d)) => {
            reg.configured = true;
            reg.chain = chain_from_doc(&d);
        }
        Ok(None) => {}
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "dlt chain load failed");
        }
    }

    reg
}

/// Load the workspace's DLT registry through the 60s cache.
pub async fn load_registry(state: &Arc<AppState>, workspace_id: &str) -> Arc<DltRegistry> {
    if let Some((at, cached)) = REGISTRY_CACHE.read().await.get(workspace_id) {
        if at.elapsed() < CACHE_TTL {
            return cached.clone();
        }
    }
    let reg = Arc::new(load_uncached(state, workspace_id).await);
    REGISTRY_CACHE
        .write()
        .await
        .insert(workspace_id.to_string(), (Instant::now(), reg.clone()));
    reg
}

/// Drop the cached registry for a workspace (called by
/// `POST /v1/internal/dlt/invalidate` after Next-side CRUD writes).
pub async fn invalidate_workspace(workspace_id: &str) {
    REGISTRY_CACHE.write().await.remove(workspace_id);
}

/// Collect a cursor into owned docs, tolerating per-doc failures (the
/// engine-wide `cursor.advance()` pattern).
async fn collect_docs(mut cursor: mongodb::Cursor<Document>) -> Vec<Document> {
    let mut out = Vec::new();
    loop {
        match cursor.advance().await {
            Ok(true) => match cursor.deserialize_current() {
                Ok(d) => out.push(d),
                Err(e) => {
                    tracing::warn!(?e, "dlt doc deserialize failed; skipping");
                }
            },
            Ok(false) => break,
            Err(e) => {
                tracing::warn!(?e, "dlt cursor advance failed");
                break;
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    #[test]
    fn template_from_doc_parses_wire_shape() {
        let d = doc! {
            "workspaceId": "ws1",
            "templateId": "1107001",
            "headerIds": ["H1", "H2"],
            "category": "promotional",
            "body": "Get {#var#}% off!",
            "peId": "PE9",
            "status": "active",
        };
        let t = template_from_doc(&d).expect("parse");
        assert_eq!(t.template_id, "1107001");
        assert_eq!(t.header_ids, vec!["H1", "H2"]);
        assert_eq!(t.category, DltCategory::Promotional);
        assert_eq!(t.pe_id, "PE9");
    }

    #[test]
    fn template_from_doc_rejects_missing_or_bad_fields() {
        assert!(template_from_doc(&doc! { "body": "x" }).is_none());
        assert!(template_from_doc(&doc! { "templateId": " ", "category": "promotional" }).is_none());
        assert!(
            template_from_doc(&doc! { "templateId": "T1", "category": "nope" }).is_none()
        );
    }

    #[test]
    fn registry_header_lookup_is_case_insensitive() {
        let reg = DltRegistry {
            headers: vec![DltHeader {
                header_id: "H1".into(),
                header: "SABNDE".into(),
                category: DltCategory::Transactional,
            }],
            ..Default::default()
        };
        assert!(reg.find_header("sabnde").is_some());
        assert!(reg.find_header("OTHER").is_none());
    }

    #[test]
    fn chain_from_doc_parses() {
        let d = doc! { "workspaceId": "ws1", "peId": "PE9", "tmIds": ["TM1"] };
        let c = chain_from_doc(&d).expect("parse");
        assert_eq!(c.pe_id, "PE9");
        assert_eq!(c.tm_ids, vec!["TM1"]);
        assert!(chain_from_doc(&doc! { "tmIds": ["TM1"] }).is_none());
    }
}
