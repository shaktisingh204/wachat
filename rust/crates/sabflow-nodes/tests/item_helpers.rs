//! Integration tests for the item-iteration SDK helpers.
//!
//! We exercise the full surface: per-item iteration with `continueOnFail`,
//! the four `pair_items` modes, and N-branch fan-in.  Because the workspace
//! has neither `proptest` nor `quickcheck`, the property-style tests are
//! lowered into deterministic table tests (per the C.2.6 sub-task spec).

use sabflow_nodes::{
    PairOptions, PairedItem, PairedRow, PairingMode, attach_paired_item, error_item,
    for_each_item, merge_branches, pair_items, paired_rows_to_items,
};
use sabflow_nodes::{NodeError, NodeResult};
use serde_json::{Value, json};

// ---------------------------------------------------------------------------
// for_each_item
// ---------------------------------------------------------------------------

#[test]
fn for_each_item_empty_input_yields_empty_output() {
    let out = for_each_item(&[], false, |_, _| Ok(json!({}))).unwrap();
    assert_eq!(out, Vec::<Value>::new());
}

#[test]
fn for_each_item_attaches_paired_item_to_every_output() {
    let items: Vec<Value> = (0..5).map(|i| json!({ "n": i })).collect();
    let out = for_each_item(&items, false, |_, v| Ok(v.clone())).unwrap();
    for (i, o) in out.iter().enumerate() {
        assert_eq!(
            o.get("pairedItem").unwrap(),
            &json!({ "item": i }),
            "item {} should carry its index back",
            i
        );
    }
}

#[test]
fn for_each_item_continue_on_fail_pushes_error_sentinels() {
    let items = vec![json!({"n": 1}), json!({"n": 2}), json!({"n": 3})];
    let out: Vec<Value> = for_each_item(&items, true, |_, v| {
        if v.get("n").and_then(|x| x.as_i64()) == Some(2) {
            Err(NodeError::Other("nope".into()))
        } else {
            Ok(v.clone())
        }
    })
    .unwrap();
    assert_eq!(out.len(), 3);
    assert!(out[1].get("error").is_some());
    assert_eq!(out[1].get("pairedItem").unwrap(), &json!({"item": 1}));
}

#[test]
fn for_each_item_continue_on_fail_false_short_circuits() {
    let items = vec![json!({}); 4];
    let mut calls = 0;
    let result: NodeResult<Vec<Value>> = for_each_item(&items, false, |i, _| {
        calls += 1;
        if i == 2 {
            Err(NodeError::Other("stop".into()))
        } else {
            Ok(json!({}))
        }
    });
    assert!(result.is_err());
    // We must have visited indices 0, 1, 2 and stopped.
    assert_eq!(calls, 3);
}

#[test]
fn for_each_item_wraps_scalar_outputs_under_value_key() {
    // If a node returns a JSON number/string, attach_paired_item should box
    // it into an object so we can still attach `pairedItem`.
    let items = vec![json!({"n": 1})];
    let out = for_each_item(&items, false, |_, _| Ok(json!(42))).unwrap();
    assert_eq!(out[0].get("value").unwrap(), &json!(42));
    assert_eq!(out[0].get("pairedItem").unwrap(), &json!({"item": 0}));
}

// ---------------------------------------------------------------------------
// pair_items — table-driven sweep over the four pairing modes
// ---------------------------------------------------------------------------

fn left_fixture() -> Vec<Value> {
    vec![
        json!({"id": "a", "name": "Alice"}),
        json!({"id": "b", "name": "Bob"}),
        json!({"id": "c", "name": "Carol"}),
    ]
}

fn right_fixture() -> Vec<Value> {
    vec![
        json!({"id": "a", "score": 10}),
        json!({"id": "b", "score": 20}),
        json!({"id": "z", "score": 99}),
    ]
}

#[test]
fn pair_items_append_concatenates_with_branch_lineage() {
    let l = left_fixture();
    let r = right_fixture();
    let rows = pair_items(&l, &r, PairingMode::Append, PairOptions::default());
    assert_eq!(rows.len(), l.len() + r.len());
    // First left row → input=0
    assert_eq!(rows[0].paired[0], PairedItem::from_branch(0, 0));
    // First right row → input=1
    assert_eq!(rows[l.len()].paired[0], PairedItem::from_branch(1, 0));
}

#[test]
fn pair_items_merge_by_position_truncates_to_shorter_by_default() {
    let l = vec![json!({"a": 1}), json!({"a": 2}), json!({"a": 3})];
    let r = vec![json!({"b": 10}), json!({"b": 20})];
    let rows = pair_items(&l, &r, PairingMode::MergeByPosition, PairOptions::default());
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[1].left, json!({"a": 2}));
    assert_eq!(rows[1].right.as_ref().unwrap(), &json!({"b": 20}));
}

#[test]
fn pair_items_merge_by_position_pads_with_null_when_opted_in() {
    let l = vec![json!({"a": 1}), json!({"a": 2}), json!({"a": 3})];
    let r = vec![json!({"b": 10})];
    let rows = pair_items(
        &l,
        &r,
        PairingMode::MergeByPosition,
        PairOptions {
            pad_with_null: true,
            ..PairOptions::default()
        },
    );
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[1].right.as_ref().unwrap(), &Value::Null);
    assert_eq!(rows[2].right.as_ref().unwrap(), &Value::Null);
}

#[test]
fn pair_items_merge_by_key_left_join_semantics() {
    let l = left_fixture();
    let r = right_fixture();
    let rows = pair_items(
        &l,
        &r,
        PairingMode::MergeByKey,
        PairOptions {
            left_key: Some("id"),
            right_key: Some("id"),
            ..PairOptions::default()
        },
    );
    assert_eq!(rows.len(), 3);
    // Alice matches.
    assert_eq!(rows[0].right.as_ref().unwrap(), &json!({"id": "a", "score": 10}));
    // Bob matches.
    assert_eq!(rows[1].right.as_ref().unwrap(), &json!({"id": "b", "score": 20}));
    // Carol has no match — left join keeps her with right=None.
    assert!(rows[2].right.is_none());
}

#[test]
fn pair_items_merge_by_key_defaults_right_key_to_left_key() {
    // Matches the forge merge_by_key convention: leave rightKey blank →
    // reuse leftKey.
    let l = vec![json!({"id": 1, "v": "x"})];
    let r = vec![json!({"id": 1, "w": "y"})];
    let rows = pair_items(
        &l,
        &r,
        PairingMode::MergeByKey,
        PairOptions {
            left_key: Some("id"),
            right_key: None,
            ..PairOptions::default()
        },
    );
    assert_eq!(rows.len(), 1);
    assert!(rows[0].right.is_some());
}

#[test]
fn pair_items_multiplex_is_cartesian_product() {
    // Deterministic "property" sweep: for every (m, n) in a small grid, the
    // multiplex result must be exactly m*n rows and each (i,j) pair must
    // appear exactly once.
    for m in 0..=4 {
        for n in 0..=4 {
            let l: Vec<Value> = (0..m).map(|i| json!({"i": i})).collect();
            let r: Vec<Value> = (0..n).map(|j| json!({"j": j})).collect();
            let rows = pair_items(&l, &r, PairingMode::Multiplex, PairOptions::default());
            assert_eq!(
                rows.len(),
                m * n,
                "multiplex({m}, {n}) should produce {} rows",
                m * n
            );
            // Every (i,j) must be present.
            let mut seen = std::collections::HashSet::new();
            for row in &rows {
                let i = row.paired[0].item;
                let j = row.paired[1].item;
                assert!(seen.insert((i, j)), "duplicate ({i}, {j})");
            }
        }
    }
}

// ---------------------------------------------------------------------------
// paired_rows_to_items
// ---------------------------------------------------------------------------

#[test]
fn paired_rows_to_items_shallow_merges_right_into_left() {
    let rows = vec![PairedRow {
        left: json!({"a": 1, "shared": "left"}),
        right: Some(json!({"b": 2, "shared": "right"})),
        paired: [PairedItem::from_branch(0, 0), PairedItem::from_branch(1, 0)],
    }];
    let items = paired_rows_to_items(rows);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].get("a").unwrap(), &json!(1));
    assert_eq!(items[0].get("b").unwrap(), &json!(2));
    // Right wins on overlap.
    assert_eq!(items[0].get("shared").unwrap(), &json!("right"));
    // pairedItem is a 2-element array of source pointers.
    let paired = items[0].get("pairedItem").unwrap().as_array().unwrap();
    assert_eq!(paired.len(), 2);
}

// ---------------------------------------------------------------------------
// merge_branches
// ---------------------------------------------------------------------------

#[test]
fn merge_branches_concatenates_in_branch_order() {
    let out = merge_branches(vec![
        vec![json!({"v": "a0"})],
        vec![json!({"v": "b0"}), json!({"v": "b1"})],
        vec![],
        vec![json!({"v": "d0"})],
    ]);
    assert_eq!(out.len(), 4);
    assert_eq!(out[0].get("v").unwrap(), &json!("a0"));
    assert_eq!(out[3].get("v").unwrap(), &json!("d0"));
}

#[test]
fn merge_branches_rewrites_pairedItem_input_to_branch_index() {
    let out = merge_branches(vec![
        vec![json!({"v": "a0"}), json!({"v": "a1"})],
        vec![json!({"v": "b0"})],
    ]);
    assert_eq!(out[0].get("pairedItem").unwrap(), &json!({"item": 0, "input": 0}));
    assert_eq!(out[1].get("pairedItem").unwrap(), &json!({"item": 1, "input": 0}));
    assert_eq!(out[2].get("pairedItem").unwrap(), &json!({"item": 0, "input": 1}));
}

#[test]
fn merge_branches_preserves_existing_item_index() {
    // If upstream already stamped an item index (e.g. from a previous merge
    // chain), we keep it so the lineage stays deep.
    let mut item = json!({"v": "x"});
    item.as_object_mut().unwrap().insert(
        "pairedItem".to_string(),
        json!({"item": 7, "input": 0}),
    );
    let out = merge_branches(vec![vec![item]]);
    assert_eq!(out[0].get("pairedItem").unwrap(), &json!({"item": 7, "input": 0}));
}

#[test]
fn merge_branches_empty_input_is_empty_output() {
    let out = merge_branches(vec![]);
    assert!(out.is_empty());
}

#[test]
fn merge_branches_table_sweep_total_count_matches_sum_of_branch_sizes() {
    // Deterministic substitute for a proptest: for branch-size tuples in a
    // small grid, the merged length must equal the sum of branch lengths,
    // and every (branch, item) pair must show up exactly once.
    let cases: &[&[usize]] = &[
        &[],
        &[0],
        &[1],
        &[1, 0, 2],
        &[3, 3, 3],
        &[5, 0, 0, 1],
        &[2, 2, 2, 2, 2],
    ];
    for case in cases {
        let branches: Vec<Vec<Value>> = case
            .iter()
            .enumerate()
            .map(|(b, &n)| {
                (0..n).map(|i| json!({"b": b, "i": i})).collect::<Vec<_>>()
            })
            .collect();
        let total: usize = case.iter().sum();
        let out = merge_branches(branches);
        assert_eq!(out.len(), total, "case = {:?}", case);
        let mut seen = std::collections::HashSet::new();
        for v in &out {
            let p = v.get("pairedItem").unwrap();
            let b = p.get("input").unwrap().as_u64().unwrap();
            let i = p.get("item").unwrap().as_u64().unwrap();
            assert!(seen.insert((b, i)), "duplicate ({b}, {i}) for case {:?}", case);
        }
    }
}

// ---------------------------------------------------------------------------
// attach_paired_item / error_item
// ---------------------------------------------------------------------------

#[test]
fn attach_paired_item_wraps_scalars() {
    let stamped = attach_paired_item(json!(42), PairedItem::new(3));
    assert_eq!(stamped.get("value").unwrap(), &json!(42));
    assert_eq!(stamped.get("pairedItem").unwrap(), &json!({"item": 3}));
}

#[test]
fn attach_paired_item_emits_compact_form_for_branch_zero() {
    let stamped = attach_paired_item(json!({"x": 1}), PairedItem::from_branch(0, 5));
    assert_eq!(stamped.get("pairedItem").unwrap(), &json!({"item": 5}));
}

#[test]
fn attach_paired_item_emits_full_form_for_nonzero_branch() {
    let stamped = attach_paired_item(json!({"x": 1}), PairedItem::from_branch(2, 5));
    assert_eq!(
        stamped.get("pairedItem").unwrap(),
        &json!({"item": 5, "input": 2})
    );
}

#[test]
fn error_item_carries_message_and_paired_item() {
    let e = NodeError::Other("boom".into());
    let sentinel = error_item(&e, Some(PairedItem::new(7)));
    assert!(sentinel.get("error").unwrap().as_str().unwrap().contains("boom"));
    assert_eq!(sentinel.get("pairedItem").unwrap(), &json!({"item": 7}));
}
