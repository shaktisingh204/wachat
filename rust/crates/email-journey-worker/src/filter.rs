//! Minimal `EmailFilterTree` → Mongo `$match` translator.
//!
//! This is an inlined copy of `email-audience::segments::filter_to_mongo`
//! so the worker crate does not need to depend on the audience HTTP
//! crate. The op set is a strict subset: anything condition nodes
//! actually use (eq, in, exists, contains, gt/gte/lt/lte, withinDays).
//! Extending this to match upstream is a copy-paste from `email-audience`.

use bson::{Bson, Document, doc};
use email_types::segment::{
    EmailFilterGroup, EmailFilterLeaf, EmailFilterNode, EmailFilterOp, EmailFilterTree,
    FilterCombinator,
};

/// Translate a filter tree into a Mongo `$match` document.
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
        EmailFilterOp::Contains => doc! { "$regex": as_str(&val), "$options": "i" },
        EmailFilterOp::StartsWith => doc! {
            "$regex": format!("^{}", regex_escape(&as_str(&val))),
            "$options": "i",
        },
        EmailFilterOp::EndsWith => doc! {
            "$regex": format!("{}$", regex_escape(&as_str(&val))),
            "$options": "i",
        },
        EmailFilterOp::Matches => doc! { "$regex": as_str(&val), "$options": "i" },
        EmailFilterOp::Exists => doc! { "$exists": true },
        EmailFilterOp::NotExists => doc! { "$exists": false },
        EmailFilterOp::WithinDays => {
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

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(
            c,
            '.' | '*'
                | '+'
                | '?'
                | '('
                | ')'
                | '['
                | ']'
                | '{'
                | '}'
                | '|'
                | '^'
                | '$'
                | '\\'
        ) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
