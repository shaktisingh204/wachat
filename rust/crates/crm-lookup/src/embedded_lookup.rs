//! Executor for entities that live as embedded sub-documents on the
//! tenant root user (`users.crmPipelines[]` and its nested `stages[]`).
//!
//! Today the TS port stores pipelines/stages this way; when the
//! collection migration lands, swap these to plain Mongo-collection
//! specs in `entities/`.

use crate::context::TenantCtx;
use bson::{Document, doc, oid::ObjectId};
use crm_lookup_types::{
    LOOKUP_DEFAULT_LIMIT, LOOKUP_MAX_LIMIT, LookupChip, LookupItem, LookupParams, LookupResult,
};
use sabnode_common::{ApiError, Result};
use sabnode_db::MongoHandle;

/// Case-insensitive substring match — same intent as the
/// `mongo_lookup::build_regex` query path, applied in-memory because
/// embedded vectors aren't worth the round-trip per stage.
fn matches(haystack: &str, needle: &str) -> bool {
    haystack
        .to_ascii_lowercase()
        .contains(&needle.to_ascii_lowercase())
}

async fn fetch_pipelines(mongo: &MongoHandle, ctx: &TenantCtx) -> Result<Vec<Document>> {
    let users = mongo.collection::<Document>("users");
    let user = users
        .find_one(doc! { "_id": ctx.user_id })
        .projection(doc! { "crmPipelines": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let Some(user) = user else {
        return Ok(vec![]);
    };

    Ok(user
        .get_array("crmPipelines")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_document().cloned())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default())
}

/// Pipeline lookup. Source: `users.crmPipelines[]`.
pub async fn pipeline_search(
    mongo: &MongoHandle,
    params: &LookupParams,
    ctx: &TenantCtx,
) -> Result<LookupResult> {
    let pipelines = fetch_pipelines(mongo, ctx).await?;

    let q = params.q.as_deref().filter(|s| !s.is_empty());
    let mut matched: Vec<LookupItem> = pipelines
        .into_iter()
        .filter(|p| {
            let name = p.get_str("name").unwrap_or("");
            q.is_none_or(|needle| matches(name, needle))
        })
        .map(|p| {
            let id = p
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default();
            let primary = p.get_str("name").unwrap_or("(unnamed)").to_owned();
            let color = p
                .get_str("color")
                .ok()
                .filter(|s| !s.is_empty())
                .map(str::to_owned);
            LookupItem {
                id,
                chip: LookupChip {
                    primary,
                    color,
                    ..Default::default()
                },
                raw: serde_json::Value::Null,
            }
        })
        .collect();

    paginate_in_memory(&mut matched, params)
}

/// Stage lookup. Source: `users.crmPipelines[].stages[]` — composite id
/// `pipelineId:stageId`.
pub async fn stage_search(
    mongo: &MongoHandle,
    params: &LookupParams,
    ctx: &TenantCtx,
) -> Result<LookupResult> {
    let pipelines = fetch_pipelines(mongo, ctx).await?;
    let q = params.q.as_deref().filter(|s| !s.is_empty());

    let mut rows: Vec<LookupItem> = vec![];
    for pipeline in pipelines {
        let pipeline_id = pipeline
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        let pipeline_name = pipeline.get_str("name").unwrap_or("").to_owned();
        let Ok(stages) = pipeline.get_array("stages") else {
            continue;
        };
        for stage_b in stages {
            let Some(stage) = stage_b.as_document() else {
                continue;
            };
            let stage_name = stage.get_str("name").unwrap_or("");
            if let Some(needle) = q {
                if !matches(stage_name, needle) && !matches(&pipeline_name, needle) {
                    continue;
                }
            }
            let stage_id = stage
                .get_object_id("_id")
                .map(|o| o.to_hex())
                .unwrap_or_default();
            let composite_id = format!("{pipeline_id}:{stage_id}");
            rows.push(LookupItem {
                id: composite_id,
                chip: LookupChip {
                    primary: stage_name.to_owned(),
                    secondary: Some(pipeline_name.clone()),
                    color: stage
                        .get_str("color")
                        .ok()
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned),
                    ..Default::default()
                },
                raw: serde_json::Value::Null,
            });
        }
    }

    paginate_in_memory(&mut rows, params)
}

fn paginate_in_memory(items: &mut Vec<LookupItem>, params: &LookupParams) -> Result<LookupResult> {
    let limit = params
        .limit
        .unwrap_or(LOOKUP_DEFAULT_LIMIT)
        .clamp(1, LOOKUP_MAX_LIMIT) as usize;
    let page = params.page.unwrap_or(0) as usize;
    let total = items.len() as u64;
    let start = page.saturating_mul(limit).min(items.len());
    let end = (start + limit).min(items.len());
    let page_slice: Vec<LookupItem> = items.drain(start..end).collect();
    let has_more = end < total as usize;
    Ok(LookupResult {
        items: page_slice,
        page: page as u32,
        limit: limit as u32,
        total: Some(total),
        has_more,
        recent: vec![],
    })
}

/// Helper exported for tests: confirm the composite id format matches
/// what TS callers produce (`<pipelineId>:<stageId>`).
pub fn format_composite_id(pipeline: &ObjectId, stage: &ObjectId) -> String {
    format!("{}:{}", pipeline.to_hex(), stage.to_hex())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn case_insensitive_match() {
        assert!(matches("Won deals", "won"));
        assert!(matches("Won deals", "DEALS"));
        assert!(!matches("Won deals", "lost"));
    }

    #[test]
    fn composite_id_format() {
        let p = ObjectId::new();
        let s = ObjectId::new();
        let composite = format_composite_id(&p, &s);
        assert!(composite.contains(':'));
        assert_eq!(composite.split(':').count(), 2);
    }
}
