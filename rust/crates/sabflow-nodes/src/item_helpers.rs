//! Item-iteration helpers — SDK utilities for node authors.
//!
//! Every n8n node hand-rolls the same three loops: walk inputs, pair two
//! branches, fan-in N branches.  This module factors them out with
//! n8n-parity semantics so C.3/C.4/C.5 node authors don't reinvent them.
//!
//! ## n8n equivalents
//!
//! * [`for_each_item`] mirrors the `for (let i = 0; i < items.length; i++)`
//!   loop you see at the top of every n8n action node (e.g.
//!   `n8n-master/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts`).
//!   The `continue_on_fail` policy mirrors `IExecuteFunctions.continueOnFail()`
//!   (see `src/lib/sabflow/n8n/interfaces.ts:1058`): on a per-item error the
//!   node pushes a sentinel `{ error: "..." }` item and keeps going.
//!
//! * [`pair_items`] mirrors the four pairing modes in
//!   `n8n-master/packages/nodes-base/nodes/Merge/v3/MergeV3.node.ts`:
//!   `append`, `mergeByPosition`, `mergeByKey`, and `multiplex`.
//!   The TypeScript forge port is at
//!   `src/lib/sabflow/forge/blocks/n8n/generic/merge.ts`.
//!
//! * [`merge_branches`] mirrors `n8n`'s N-input fan-in (the "combine" path on
//!   the Merge V3 node) and preserves the
//!   [`IPairedItemData`](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/Interfaces.ts)
//!   shape declared at `src/lib/sabflow/n8n/interfaces.ts:1393`:
//!
//!   ```text
//!   IPairedItemData { item: number; input?: number; sourceOverwrite?: ISourceData; }
//!   ```
//!
//! These helpers operate on `serde_json::Value` items — the same shape that
//! [`NodeInput::items`](crate::context::NodeInput) and
//! [`NodeOutput`](crate::context::NodeOutput) use — so node authors can drop
//! them in directly without wrapping or unwrapping.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::error::NodeError;

// ---------------------------------------------------------------------------
// Paired-item metadata (mirror of n8n's IPairedItemData)
// ---------------------------------------------------------------------------

/// Mirror of n8n's `IPairedItemData` (see `src/lib/sabflow/n8n/interfaces.ts:1393`).
///
/// Every emitted item should carry a `pairedItem` field pointing back at the
/// upstream item it derives from so the editor's lineage / "show me where
/// this came from" view works correctly.  When a node merges N inputs, each
/// emitted item must declare which `input` branch and which `item` index it
/// came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedItem {
    /// Index inside the upstream branch's items list.
    pub item: usize,
    /// Which input branch the item came from. `0` is the default (the
    /// single-input case) and matches n8n's implicit fallback.
    #[serde(default)]
    pub input: usize,
}

impl PairedItem {
    pub const fn new(item: usize) -> Self {
        Self { item, input: 0 }
    }
    pub const fn from_branch(input: usize, item: usize) -> Self {
        Self { item, input }
    }
}

/// Attach a `pairedItem` field on a JSON item, in n8n's exact shape.
///
/// If the item is not a JSON object, it is wrapped under a `value` key — the
/// same upgrade path [`crate::nodes`] use for scalar inputs.  When `input` is
/// `0` we emit the compact `{ "item": N }` form, matching the n8n
/// `pairedItem?: IPairedItemData | IPairedItemData[] | number` union (the
/// numeric form is the same as `{ item: N }`).
pub fn attach_paired_item(item: Value, paired: PairedItem) -> Value {
    // If the item isn't an object, box it under `value` first so we have a
    // home for the `pairedItem` field.  Done before borrowing so the borrow
    // checker is happy.
    let mut wrapped = match item {
        Value::Object(_) => item,
        other => {
            let mut m = Map::new();
            m.insert("value".to_string(), other);
            Value::Object(m)
        }
    };
    let paired_json = if paired.input == 0 {
        json!({ "item": paired.item })
    } else {
        json!({ "item": paired.item, "input": paired.input })
    };
    if let Some(obj) = wrapped.as_object_mut() {
        obj.insert("pairedItem".to_string(), paired_json);
    }
    wrapped
}

/// Build a sentinel error item — the shape n8n emits when `continueOnFail`
/// is true and a per-item operation throws.  Keeping the shape stable lets
/// downstream `IF`/`Filter` nodes branch on `$json.error` reliably.
pub fn error_item(err: &NodeError, paired: Option<PairedItem>) -> Value {
    let mut obj = Map::new();
    obj.insert("error".to_string(), Value::String(err.to_string()));
    if let Some(p) = paired {
        let paired_json = if p.input == 0 {
            json!({ "item": p.item })
        } else {
            json!({ "item": p.item, "input": p.input })
        };
        obj.insert("pairedItem".to_string(), paired_json);
    }
    Value::Object(obj)
}

// ---------------------------------------------------------------------------
// for_each_item — the per-item loop every action node hand-rolls
// ---------------------------------------------------------------------------

/// n8n parity: walk every item, call `f`, collect outputs.  Mirrors the
/// `for (let i = 0; i < items.length; i++) { try { ... } catch (err) { if
/// (this.continueOnFail()) { returnData.push({ json: { error: err.message } }) }
/// else throw err; } }` pattern that opens nearly every n8n action node.
///
/// * `continue_on_fail = false` — bails on the first error, returning it.
/// * `continue_on_fail = true`  — pushes [`error_item`] sentinels in place
///   of failures and returns `Ok(out)`.
///
/// `f` receives the **0-based item index** as its first arg, matching n8n's
/// `itemIndex` convention.  The output item is auto-stamped with a
/// `pairedItem` field pointing back at the source index so lineage stays
/// intact — node authors don't have to remember to do it manually.
pub fn for_each_item<F>(
    items: &[Value],
    continue_on_fail: bool,
    mut f: F,
) -> Result<Vec<Value>, NodeError>
where
    F: FnMut(usize, &Value) -> Result<Value, NodeError>,
{
    let mut out = Vec::with_capacity(items.len());
    for (idx, item) in items.iter().enumerate() {
        match f(idx, item) {
            Ok(v) => out.push(attach_paired_item(v, PairedItem::new(idx))),
            Err(err) => {
                if continue_on_fail {
                    out.push(error_item(&err, Some(PairedItem::new(idx))));
                } else {
                    return Err(err);
                }
            }
        }
    }
    Ok(out)
}

/// Async variant of [`for_each_item`] for nodes that await per-item work
/// (HTTP, DB, etc.).  Same contract — same `continueOnFail` semantics, same
/// auto-attached `pairedItem` metadata.
pub async fn for_each_item_async<F, Fut>(
    items: &[Value],
    continue_on_fail: bool,
    mut f: F,
) -> Result<Vec<Value>, NodeError>
where
    F: FnMut(usize, &Value) -> Fut,
    Fut: std::future::Future<Output = Result<Value, NodeError>>,
{
    let mut out = Vec::with_capacity(items.len());
    for (idx, item) in items.iter().enumerate() {
        match f(idx, item).await {
            Ok(v) => out.push(attach_paired_item(v, PairedItem::new(idx))),
            Err(err) => {
                if continue_on_fail {
                    out.push(error_item(&err, Some(PairedItem::new(idx))));
                } else {
                    return Err(err);
                }
            }
        }
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// pair_items — the four binary pairing modes
// ---------------------------------------------------------------------------

/// The four pairing modes the n8n Merge V3 node exposes.  Source:
/// `n8n-master/packages/nodes-base/nodes/Merge/v3/MergeV3.node.ts`
/// (the `combineByMode` selector).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PairingMode {
    /// Concatenate `left ++ right`.  n8n calls this `append`.
    Append,
    /// Walk left and right in lock-step; pair item `i` from each.
    /// Items past the shorter list are dropped (n8n's default).  When the
    /// `pad_with_null` flag on [`PairOptions`] is true, the shorter side is
    /// padded with `Value::Null` so every left index produces a pair —
    /// useful when the node-author wants an outer-style join.
    MergeByPosition,
    /// Outer-join two arrays of objects on a shared key.  Left items missing
    /// from the right are emitted with `Value::Null` for the right half,
    /// matching n8n's "left join" default in `mergeByKey`.
    MergeByKey,
    /// Cartesian product — every left item paired with every right item.
    Multiplex,
}

/// Options for [`pair_items`].  Most callers can use `PairOptions::default()`.
#[derive(Debug, Clone, Default)]
pub struct PairOptions<'a> {
    /// Key on each left item to join on, for [`PairingMode::MergeByKey`].
    pub left_key: Option<&'a str>,
    /// Key on each right item to join on.  When `None`, falls back to
    /// `left_key` — same convention as the TS forge `merge_by_key` action
    /// (`src/lib/sabflow/forge/blocks/n8n/generic/merge.ts:53`).
    pub right_key: Option<&'a str>,
    /// When the pairing mode is [`PairingMode::MergeByPosition`], pad the
    /// shorter side with `Value::Null` so every index produces a pair.
    pub pad_with_null: bool,
}

/// One row of a pairing result.  `right` is `None` for unpaired left items
/// in [`PairingMode::MergeByKey`] (the outer-join semantics).
#[derive(Debug, Clone)]
pub struct PairedRow {
    pub left: Value,
    pub right: Option<Value>,
    pub paired: [PairedItem; 2],
}

/// n8n parity: pair items from two input branches per the selected mode.
///
/// The `paired` field on each [`PairedRow`] preserves the lineage back to
/// both inputs so the editor can highlight "this output came from left[i]
/// and right[j]" — same job [`IPairedItemData[]`] does in n8n.
pub fn pair_items(
    left: &[Value],
    right: &[Value],
    mode: PairingMode,
    opts: PairOptions<'_>,
) -> Vec<PairedRow> {
    match mode {
        PairingMode::Append => {
            let mut out = Vec::with_capacity(left.len() + right.len());
            for (i, l) in left.iter().enumerate() {
                out.push(PairedRow {
                    left: l.clone(),
                    right: None,
                    paired: [PairedItem::from_branch(0, i), PairedItem::from_branch(0, i)],
                });
            }
            for (j, r) in right.iter().enumerate() {
                out.push(PairedRow {
                    left: r.clone(),
                    right: None,
                    paired: [PairedItem::from_branch(1, j), PairedItem::from_branch(1, j)],
                });
            }
            out
        }

        PairingMode::MergeByPosition => {
            let n = if opts.pad_with_null {
                left.len().max(right.len())
            } else {
                left.len().min(right.len())
            };
            let mut out = Vec::with_capacity(n);
            for i in 0..n {
                let l = left.get(i).cloned().unwrap_or(Value::Null);
                let r = right.get(i).cloned().unwrap_or(Value::Null);
                out.push(PairedRow {
                    left: l,
                    right: Some(r),
                    paired: [PairedItem::from_branch(0, i), PairedItem::from_branch(1, i)],
                });
            }
            out
        }

        PairingMode::MergeByKey => {
            let lk = opts.left_key.unwrap_or("");
            let rk = opts.right_key.unwrap_or(lk);
            let mut out = Vec::with_capacity(left.len());
            for (i, l) in left.iter().enumerate() {
                let key_val = l.get(lk).cloned();
                let mut match_idx: Option<usize> = None;
                if let Some(kv) = key_val.as_ref() {
                    if !kv.is_null() {
                        for (j, r) in right.iter().enumerate() {
                            if r.get(rk) == Some(kv) {
                                match_idx = Some(j);
                                break;
                            }
                        }
                    }
                }
                let (right_val, paired_right) = match match_idx {
                    Some(j) => (Some(right[j].clone()), PairedItem::from_branch(1, j)),
                    None => (None, PairedItem::from_branch(0, i)),
                };
                out.push(PairedRow {
                    left: l.clone(),
                    right: right_val,
                    paired: [PairedItem::from_branch(0, i), paired_right],
                });
            }
            out
        }

        PairingMode::Multiplex => {
            let mut out = Vec::with_capacity(left.len() * right.len());
            for (i, l) in left.iter().enumerate() {
                for (j, r) in right.iter().enumerate() {
                    out.push(PairedRow {
                        left: l.clone(),
                        right: Some(r.clone()),
                        paired: [PairedItem::from_branch(0, i), PairedItem::from_branch(1, j)],
                    });
                }
            }
            out
        }
    }
}

/// Convenience: flatten a `Vec<PairedRow>` into the JSON-item shape the
/// engine ships to downstream nodes.  Objects from `left` and `right` are
/// shallow-merged (right wins), the `pairedItem` is preserved as an array of
/// the two source pointers, exactly matching the n8n
/// `pairedItem?: IPairedItemData[]` shape.
pub fn paired_rows_to_items(rows: Vec<PairedRow>) -> Vec<Value> {
    rows.into_iter()
        .map(|row| {
            let mut obj: Map<String, Value> = match row.left {
                Value::Object(m) => m,
                other => {
                    let mut m = Map::new();
                    m.insert("value".to_string(), other);
                    m
                }
            };
            if let Some(r) = row.right {
                match r {
                    Value::Object(rm) => {
                        for (k, v) in rm {
                            obj.insert(k, v);
                        }
                    }
                    other => {
                        obj.insert("right".to_string(), other);
                    }
                }
            }
            let paired = json!([
                {
                    "item": row.paired[0].item,
                    "input": row.paired[0].input,
                },
                {
                    "item": row.paired[1].item,
                    "input": row.paired[1].input,
                }
            ]);
            obj.insert("pairedItem".to_string(), paired);
            Value::Object(obj)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// merge_branches — N-input fan-in
// ---------------------------------------------------------------------------

/// n8n parity: fan-in N input branches into a single output by concatenation,
/// preserving `pairedItem` metadata on every item so the editor's lineage
/// view (`workflow-data-proxy.ts` and friends) can resolve "show me the
/// source row" across the merge.
///
/// The first branch becomes `input: 0`, the second `input: 1`, etc.  Each
/// item's pre-existing `pairedItem` is preserved when present — only the
/// `input` index is updated to reflect the merged branch.  This is the same
/// semantics as the Merge V3 "append" combine mode when invoked with more
/// than two inputs.
pub fn merge_branches(branches: Vec<Vec<Value>>) -> Vec<Value> {
    let total: usize = branches.iter().map(|b| b.len()).sum();
    let mut out = Vec::with_capacity(total);
    for (branch_idx, items) in branches.into_iter().enumerate() {
        for (item_idx, item) in items.into_iter().enumerate() {
            out.push(rewrite_paired_input(item, branch_idx, item_idx));
        }
    }
    out
}

/// Update or attach the `pairedItem.input` on an item to point at the merged
/// branch index.  When an item already has a `pairedItem`, we preserve its
/// `item` index (deepest known source) and only override `input`.
fn rewrite_paired_input(item: Value, branch_idx: usize, item_idx: usize) -> Value {
    let mut wrapped = match item {
        Value::Object(_) => item,
        other => {
            let mut m = Map::new();
            m.insert("value".to_string(), other);
            Value::Object(m)
        }
    };
    if let Some(obj) = wrapped.as_object_mut() {
        // Preserve original `item` if present, otherwise use the merged index.
        let original_item_idx = obj
            .get("pairedItem")
            .and_then(|p| match p {
                Value::Object(m) => m.get("item").and_then(|v| v.as_u64()).map(|x| x as usize),
                Value::Number(n) => n.as_u64().map(|x| x as usize),
                Value::Array(arr) => arr
                    .first()
                    .and_then(|p0| p0.get("item").and_then(|v| v.as_u64()))
                    .map(|x| x as usize),
                _ => None,
            })
            .unwrap_or(item_idx);
        obj.insert(
            "pairedItem".to_string(),
            json!({ "item": original_item_idx, "input": branch_idx }),
        );
    }
    wrapped
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn for_each_item_happy_path_attaches_paired_item() {
        let items = vec![json!({"n": 1}), json!({"n": 2}), json!({"n": 3})];
        let out = for_each_item(&items, false, |i, v| {
            let n = v.get("n").and_then(|x| x.as_i64()).unwrap_or(0);
            Ok(json!({ "n": n, "i": i }))
        })
        .unwrap();
        assert_eq!(out.len(), 3);
        assert_eq!(out[0].get("pairedItem").unwrap(), &json!({"item": 0}));
        assert_eq!(out[1].get("i").unwrap(), &json!(1));
    }

    #[test]
    fn for_each_item_bails_when_continue_on_fail_false() {
        let items = vec![json!({"n": 1}), json!({"n": 2})];
        let result: Result<Vec<Value>, _> = for_each_item(&items, false, |_, v| {
            if v.get("n").and_then(|x| x.as_i64()) == Some(2) {
                Err(NodeError::Other("boom".into()))
            } else {
                Ok(v.clone())
            }
        });
        assert!(result.is_err());
    }

    #[test]
    fn pair_items_multiplex_is_cartesian() {
        let left = vec![json!({"a": 1}), json!({"a": 2})];
        let right = vec![json!({"b": 10}), json!({"b": 20}), json!({"b": 30})];
        let rows = pair_items(
            &left,
            &right,
            PairingMode::Multiplex,
            PairOptions::default(),
        );
        assert_eq!(rows.len(), 6);
    }

    #[test]
    fn merge_branches_preserves_lineage() {
        let a = vec![json!({"v": "a0"}), json!({"v": "a1"})];
        let b = vec![json!({"v": "b0"})];
        let out = merge_branches(vec![a, b]);
        assert_eq!(out.len(), 3);
        assert_eq!(
            out[0].get("pairedItem").unwrap(),
            &json!({"item": 0, "input": 0})
        );
        assert_eq!(
            out[2].get("pairedItem").unwrap(),
            &json!({"item": 0, "input": 1})
        );
    }
}
