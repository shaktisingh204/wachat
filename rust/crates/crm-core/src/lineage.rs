//! `lineage[]` — chain of cross-document conversions tracking the
//! provenance of a record (Lead → Deal → Quotation → SO → Invoice etc.).
//! Mirrors §13.5 of `crm_function_plan.md` and the TS helpers in
//! `src/lib/lineage.ts`. The TS port enumerates 16 known kinds; we keep
//! `kind` as a transparent string so adding a new source doesn't
//! require a crate edit.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineageRef {
    /// Logical entity kind ("lead", "deal", "quotation", "salesOrder",
    /// "invoice", "creditNote", "purchaseOrder", "bill", "grn", …).
    pub kind: String,
    pub id: ObjectId,
}

impl LineageRef {
    pub fn new(kind: impl Into<String>, id: ObjectId) -> Self {
        Self {
            kind: kind.into(),
            id,
        }
    }
}

/// Build the lineage for a freshly-created child document, given the
/// parent's `kind` + `id` + the parent's own `lineage` chain.
///
/// The result is `parent.lineage ++ [parent_ref]` — i.e. the new doc
/// inherits everything the parent already had as its provenance, plus
/// a pointer back to the parent itself. Mirrors `buildLineageFromParent`
/// in `src/lib/lineage.ts`.
///
/// ```text
/// parent.lineage = [Lead, Deal, Quotation]      kind = "quotation"
/// → child.lineage = [Lead, Deal, Quotation, Quotation:<parent_id>]
/// ```
///
/// Self-cycle prevention: if the parent's lineage already contains a
/// ref with the same `(kind, id)`, we don't duplicate it. This matters
/// for "convert back" flows (rare but possible).
pub fn build_lineage_from_parent(
    parent_kind: impl Into<String>,
    parent_id: ObjectId,
    parent_lineage: &[LineageRef],
) -> Vec<LineageRef> {
    let parent_ref = LineageRef::new(parent_kind, parent_id);
    let mut out: Vec<LineageRef> = parent_lineage.to_vec();
    if !out
        .iter()
        .any(|r| r.id == parent_ref.id && r.kind == parent_ref.kind)
    {
        out.push(parent_ref);
    }
    out
}

/// Append `next` to `prev`, deduping any existing ref with the same
/// `(kind, id)` so the chain never repeats. Mirrors `appendLineage` in
/// the TS lineage helpers.
///
/// Order is preserved — duplicates are removed in-place rather than
/// reordered, so the most recent occurrence of an id is kept and the
/// older copy is dropped.
pub fn append_lineage(prev: &[LineageRef], next: LineageRef) -> Vec<LineageRef> {
    let mut out: Vec<LineageRef> = prev
        .iter()
        .filter(|r| !(r.id == next.id && r.kind == next.kind))
        .cloned()
        .collect();
    out.push(next);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(kind: &str) -> LineageRef {
        LineageRef::new(kind, ObjectId::new())
    }

    #[test]
    fn build_from_empty_parent_creates_single_entry() {
        let id = ObjectId::new();
        let chain = build_lineage_from_parent("lead", id, &[]);
        assert_eq!(chain.len(), 1);
        assert_eq!(chain[0].kind, "lead");
        assert_eq!(chain[0].id, id);
    }

    #[test]
    fn build_from_parent_inherits_chain() {
        let lead = r("lead");
        let deal = r("deal");
        let quotation_id = ObjectId::new();
        let chain =
            build_lineage_from_parent("quotation", quotation_id, &[lead.clone(), deal.clone()]);
        assert_eq!(chain.len(), 3);
        assert_eq!(chain[0], lead);
        assert_eq!(chain[1], deal);
        assert_eq!(chain[2].kind, "quotation");
        assert_eq!(chain[2].id, quotation_id);
    }

    #[test]
    fn build_from_parent_dedupes_self_cycle() {
        // Parent's own lineage somehow already contains a pointer back
        // to itself — don't double-push.
        let parent_id = ObjectId::new();
        let self_ref = LineageRef::new("quotation", parent_id);
        let chain =
            build_lineage_from_parent("quotation", parent_id, std::slice::from_ref(&self_ref));
        assert_eq!(chain.len(), 1);
        assert_eq!(chain[0], self_ref);
    }

    #[test]
    fn append_dedupes_existing_ref() {
        let lead = r("lead");
        let deal = r("deal");
        let prev = vec![lead.clone(), deal.clone()];
        let appended = append_lineage(&prev, deal.clone());
        // The existing `deal` is dropped from the middle and re-added
        // at the tail.
        assert_eq!(appended.len(), 2);
        assert_eq!(appended[0], lead);
        assert_eq!(appended[1], deal);
    }

    #[test]
    fn append_to_empty_yields_single_entry() {
        let invoice = r("invoice");
        let chain = append_lineage(&[], invoice.clone());
        assert_eq!(chain.len(), 1);
        assert_eq!(chain[0], invoice);
    }
}
