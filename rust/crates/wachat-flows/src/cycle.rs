//! Flow-graph cycle detection.
//!
//! Mirrors the `detectCycle(nodes, edges)` call site in
//! `src/app/actions/flow.actions.ts`. The TS file currently inlines a stub
//! that always returns `{ hasCycle: false }` (the original implementation
//! lived in a removed `sabflow/validation` module). We port a real DFS
//! cycle check here so the Rust crate enforces the contract that the TS
//! handler advertises with its `Infinite loop detected in flow.` error.
//!
//! Algorithm: classic 3-color DFS over an adjacency list keyed by
//! `node.id`. Edges that reference unknown nodes are skipped — they're
//! ignored in the TS too (the UI prunes them on save) and emitting an error
//! for them here would surface noise unrelated to cycles.

use std::collections::HashMap;

use crate::dto::{FlowEdge, FlowNode};

/// Outcome of running cycle detection over a flow graph. Field shape
/// matches the TS object literal `{ hasCycle: boolean }`.
#[derive(Debug, Clone, Copy)]
pub struct CycleReport {
    pub has_cycle: bool,
}

/// Returns `has_cycle = true` iff the directed graph
/// `(nodes, edges)` contains at least one cycle.
pub fn detect_cycle(nodes: &[FlowNode], edges: &[FlowEdge]) -> CycleReport {
    // Build adjacency list keyed by node id. Use slice-of-indices so we can
    // recurse without re-cloning ids.
    let mut idx: HashMap<&str, usize> = HashMap::with_capacity(nodes.len());
    for (i, n) in nodes.iter().enumerate() {
        idx.insert(n.id.as_str(), i);
    }

    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); nodes.len()];
    for e in edges {
        match (idx.get(e.source.as_str()), idx.get(e.target.as_str())) {
            (Some(&s), Some(&t)) => adj[s].push(t),
            _ => continue, // unknown endpoint — ignore (matches TS leniency)
        }
    }

    // 0 = unvisited, 1 = in current DFS stack, 2 = fully explored.
    let mut color = vec![0u8; nodes.len()];

    for start in 0..nodes.len() {
        if color[start] != 0 {
            continue;
        }
        // Iterative DFS so deep graphs don't blow the call stack.
        let mut stack: Vec<(usize, usize)> = Vec::new(); // (node, next-child-index)
        stack.push((start, 0));
        color[start] = 1;

        while let Some(&(u, ci)) = stack.last() {
            if ci < adj[u].len() {
                let v = adj[u][ci];
                // Advance the cursor on the parent before descending so we
                // resume past this child when we pop.
                let last = stack.last_mut().unwrap();
                last.1 += 1;

                match color[v] {
                    0 => {
                        color[v] = 1;
                        stack.push((v, 0));
                    }
                    1 => {
                        // Back-edge into the current DFS stack → cycle.
                        return CycleReport { has_cycle: true };
                    }
                    _ => {}
                }
            } else {
                color[u] = 2;
                stack.pop();
            }
        }
    }

    CycleReport { has_cycle: false }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn n(id: &str) -> FlowNode {
        FlowNode {
            id: id.to_owned(),
            node_type: "text".to_owned(),
            data: json!({}),
            position: crate::dto::Position { x: 0.0, y: 0.0 },
        }
    }
    fn e(id: &str, src: &str, tgt: &str) -> FlowEdge {
        FlowEdge {
            id: id.to_owned(),
            source: src.to_owned(),
            target: tgt.to_owned(),
            source_handle: None,
            target_handle: None,
        }
    }

    #[test]
    fn empty_graph_has_no_cycle() {
        assert!(!detect_cycle(&[], &[]).has_cycle);
    }

    #[test]
    fn linear_chain_has_no_cycle() {
        let nodes = vec![n("a"), n("b"), n("c")];
        let edges = vec![e("e1", "a", "b"), e("e2", "b", "c")];
        assert!(!detect_cycle(&nodes, &edges).has_cycle);
    }

    #[test]
    fn diamond_has_no_cycle() {
        let nodes = vec![n("a"), n("b"), n("c"), n("d")];
        let edges = vec![
            e("e1", "a", "b"),
            e("e2", "a", "c"),
            e("e3", "b", "d"),
            e("e4", "c", "d"),
        ];
        assert!(!detect_cycle(&nodes, &edges).has_cycle);
    }

    #[test]
    fn self_loop_is_a_cycle() {
        let nodes = vec![n("a")];
        let edges = vec![e("e1", "a", "a")];
        assert!(detect_cycle(&nodes, &edges).has_cycle);
    }

    #[test]
    fn back_edge_is_a_cycle() {
        let nodes = vec![n("a"), n("b"), n("c")];
        let edges = vec![e("e1", "a", "b"), e("e2", "b", "c"), e("e3", "c", "a")];
        assert!(detect_cycle(&nodes, &edges).has_cycle);
    }

    #[test]
    fn unknown_endpoints_are_ignored() {
        let nodes = vec![n("a"), n("b")];
        let edges = vec![e("e1", "a", "b"), e("e2", "ghost", "a")];
        assert!(!detect_cycle(&nodes, &edges).has_cycle);
    }
}
