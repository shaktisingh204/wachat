//! Segment filter-tree → Mongo aggregation pipeline.
//!
//! Translates the JSON filter tree (`EmailFilterTree`) into a Mongo `$match`
//! document that runs against `email_subscribers`. Pure function — no I/O.

use bson::{Bson, Document, doc};
use email_types::segment::{
    EmailFilterGroup, EmailFilterLeaf, EmailFilterNode, EmailFilterOp, EmailFilterTree,
    FilterCombinator,
};

/// Convert a filter tree into a Mongo `$match` document.
pub fn filter_to_mongo(tree: &EmailFilterTree) -> Document {
    group_to_mongo(tree)
}

fn group_to_mongo(group: &EmailFilterGroup) -> Document {
    let key = match group.combinator {
        FilterCombinator::And => "$and",
        FilterCombinator::Or => "$or",
    };
    let children: Vec<Bson> = group
        .filters
        .iter()
        .map(|node| match node {
            EmailFilterNode::Group(g) => Bson::Document(group_to_mongo(g)),
            EmailFilterNode::Leaf(l) => Bson::Document(leaf_to_mongo(l)),
        })
        .collect();
    if children.is_empty() {
        // Mongo: empty $and / $or is invalid — return match-all.
        Document::new()
    } else {
        doc! { key: children }
    }
}

fn leaf_to_mongo(leaf: &EmailFilterLeaf) -> Document {
    let val = leaf
        .value
        .as_ref()
        .and_then(|v| bson::to_bson(v).ok())
        .unwrap_or(Bson::Null);

    let predicate = match leaf.op {
        EmailFilterOp::Eq => doc! { "$eq": val },
        EmailFilterOp::Ne => doc! { "$ne": val },
        EmailFilterOp::In => doc! { "$in": val },
        EmailFilterOp::Nin => doc! { "$nin": val },
        EmailFilterOp::Gt => doc! { "$gt": val },
        EmailFilterOp::Gte => doc! { "$gte": val },
        EmailFilterOp::Lt => doc! { "$lt": val },
        EmailFilterOp::Lte => doc! { "$lte": val },
        EmailFilterOp::Contains => doc! {
            "$regex": as_regex(&val, false, false),
            "$options": "i",
        },
        EmailFilterOp::StartsWith => doc! {
            "$regex": as_regex(&val, true, false),
            "$options": "i",
        },
        EmailFilterOp::EndsWith => doc! {
            "$regex": as_regex(&val, false, true),
            "$options": "i",
        },
        EmailFilterOp::Matches => doc! {
            "$regex": as_str(&val),
            "$options": "i",
        },
        EmailFilterOp::Exists => doc! { "$exists": true },
        EmailFilterOp::NotExists => doc! { "$exists": false },
        EmailFilterOp::WithinDays => {
            // value = number of days. Match docs where field >= now - days.
            let days = as_str(&val).parse::<i64>().unwrap_or(0);
            let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
            doc! { "$gte": cutoff }
        }
        EmailFilterOp::Before => doc! { "$lt": val },
        EmailFilterOp::After => doc! { "$gt": val },
    };

    doc! { leaf.field.clone(): predicate }
}

fn as_str(b: &Bson) -> String {
    match b {
        Bson::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn as_regex(b: &Bson, anchor_start: bool, anchor_end: bool) -> String {
    let raw = as_str(b);
    let escaped = regex_escape(&raw);
    let mut out = String::new();
    if anchor_start {
        out.push('^');
    }
    out.push_str(&escaped);
    if anchor_end {
        out.push('$');
    }
    out
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(
            c,
            '.' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '^' | '$' | '\\'
        ) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
