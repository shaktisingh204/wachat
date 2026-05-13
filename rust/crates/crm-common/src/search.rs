//! Free-text search helpers.
//!
//! Builds a Mongo `$or` filter against caller-supplied searchable fields,
//! with case-insensitive `$regex` semantics and a properly-escaped pattern.

use bson::{Bson, Document, doc};

/// Escape regex metacharacters so user-supplied search text matches literally.
pub fn escape_regex(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '.' | '*' | '+' | '?' | '|' | '(' | ')' | '[' | ']' | '{' | '}' | '^' | '$' | '\\' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}

/// Build a Mongo `{ $or: [{ field: { $regex, $options: 'i' } }, …] }` filter
/// for case-insensitive contains-search across `searchable_fields`.
///
/// Returns an empty `Document` if `q` is empty or has no searchable fields
/// — callers should merge with their tenant filter via `Document::extend` /
/// `$and`.
pub fn build_q_filter(q: &str, searchable_fields: &[&str]) -> Document {
    let q = q.trim();
    if q.is_empty() || searchable_fields.is_empty() {
        return Document::new();
    }
    let pattern = escape_regex(q);
    let clauses: Vec<Bson> = searchable_fields
        .iter()
        .map(|field| {
            Bson::Document(doc! {
                *field: { "$regex": &pattern, "$options": "i" }
            })
        })
        .collect();
    doc! { "$or": clauses }
}
