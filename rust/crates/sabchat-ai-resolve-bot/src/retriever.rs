//! Lexical retriever over `sabchat_kb_articles`.
//!
//! For the MVP we deliberately ignore embeddings (the schema reserves a
//! `embedding?` field, but indexing is owned by the `sabchat-knowledge`
//! crate and is not required to ship the bot). We rely on a Mongo
//! `$text` index on `{ title, body }` instead — the same approach the
//! legacy TS Help Center search uses.
//!
//! ## Tenancy
//!
//! Every query carries `tenant_id` as a filter — no cross-tenant leakage
//! is possible at the storage layer.
//!
//! ## Output shape
//!
//! Each hit is normalised into [`Retrieval`] with a small snippet (first
//! ~240 chars of body) so the handler can compose a prompt without
//! re-fetching documents.

use anyhow::Context;
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_db::mongo::MongoHandle;

/// Mongo collection owned by the `sabchat-knowledge` agent.
const KB_ARTICLES_COLL: &str = "sabchat_kb_articles";

/// Max length (in `char`s) of the snippet we lift out of `body`.
const SNIPPET_MAX_CHARS: usize = 240;

/// One retrieved evidence row.
#[derive(Debug, Clone)]
pub struct Retrieval {
    /// `"article"` for a KB article, `"prior"` for a past resolved
    /// outbound message (reserved for future use; the MVP retriever
    /// only returns articles).
    pub kind: String,
    /// Hex `ObjectId` of the underlying document.
    pub id: String,
    /// Display title.
    pub title: String,
    /// Short body excerpt used to seed the prompt.
    pub snippet: String,
}

/// Retrieve up to `k` matching KB articles for `query` under `tenant_id`.
///
/// The query is run as a Mongo `$text` search; we sort by the built-in
/// `textScore` metadata so the most relevant hits come first. Articles
/// without a usable `title` are dropped because they're useless as
/// citations.
///
/// Empty / whitespace-only queries short-circuit to an empty result so
/// the caller doesn't have to special-case them.
pub async fn retrieve(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    query: &str,
    k: usize,
) -> anyhow::Result<Vec<Retrieval>> {
    let trimmed = query.trim();
    if trimmed.is_empty() || k == 0 {
        return Ok(Vec::new());
    }

    let coll = mongo.collection::<Document>(KB_ARTICLES_COLL);

    // `$text` is the cheapest indexable lexical match Mongo offers; the
    // `sabchat-knowledge` crate is responsible for declaring the
    // matching text index on `{ title, body }`.
    let filter = doc! {
        "tenantId": tenant_id,
        "$text": { "$search": trimmed },
    };

    let opts = FindOptions::builder()
        // `textScore` is a magic projection key; sorting by it surfaces
        // the most relevant hits first.
        .sort(doc! { "score": { "$meta": "textScore" } })
        .projection(doc! {
            "title": 1,
            "body": 1,
            "score": { "$meta": "textScore" },
        })
        .limit(k as i64)
        .build();

    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .context("sabchat_kb_articles.find")?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .context("sabchat_kb_articles.collect")?;

    let mut out = Vec::with_capacity(docs.len());
    for d in docs {
        let id = match d.get_object_id("_id") {
            Ok(o) => o.to_hex(),
            Err(_) => continue,
        };
        let title = d
            .get_str("title")
            .map(str::to_owned)
            .unwrap_or_default();
        if title.is_empty() {
            // Untitled articles aren't useful as citations.
            continue;
        }
        let body = d.get_str("body").unwrap_or("");
        let snippet = truncate_chars(body, SNIPPET_MAX_CHARS);

        out.push(Retrieval {
            kind: "article".to_owned(),
            id,
            title,
            snippet,
        });
    }

    Ok(out)
}

/// Truncate `s` to at most `max` Unicode scalar values. Adequate for
/// prompt seeding — grapheme-cluster accuracy is not required here.
fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_owned();
    }
    s.chars().take(max).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_chars_short_string_passes_through() {
        assert_eq!(truncate_chars("hello", 240), "hello");
    }

    #[test]
    fn truncate_chars_clips_long_string() {
        let long = "a".repeat(500);
        let out = truncate_chars(&long, SNIPPET_MAX_CHARS);
        assert_eq!(out.chars().count(), SNIPPET_MAX_CHARS);
    }
}
