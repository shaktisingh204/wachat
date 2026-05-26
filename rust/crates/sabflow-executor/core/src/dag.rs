use crate::ir::{IRNode, WorkflowGraph};
use std::collections::{HashMap, HashSet, VecDeque};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DagError {
    #[error("Edge from unknown node '{0}'")]
    EdgeFromUnknownNode(String),
    #[error("Edge to unknown node '{0}'")]
    EdgeToUnknownNode(String),
    #[error("No trigger found")]
    NoTrigger,
    #[error("Trigger references unknown node '{0}'")]
    TriggerUnknownNode(String),
    #[error("Missing type version for node '{0}'")]
    MissingTypeVersion(String),
    #[error("Cycle detected through nodes: {0:?}")]
    CycleDetected(Vec<String>),
}

pub struct DagEngine {
    graph: WorkflowGraph,
    allowed_loop_types: HashSet<String>,
}

impl DagEngine {
    pub fn new(graph: WorkflowGraph, allowed_loop_types: HashSet<String>) -> Self {
        Self {
            graph,
            allowed_loop_types,
        }
    }

    /// Build the adjacency map for topological sorting / cycle detection.
    /// Excludes loop-back edges (where target is an allowed loop type and input_index >= 1).
    fn build_dag_adjacency(&self) -> HashMap<String, Vec<String>> {
        let mut adj = HashMap::new();
        let node_by_id: HashMap<String, &IRNode> =
            self.graph.nodes.iter().map(|n| (n.id.clone(), n)).collect();

        for node in &self.graph.nodes {
            adj.insert(node.id.clone(), Vec::new());
        }

        for edge in &self.graph.edges {
            if !node_by_id.contains_key(&edge.from.node_id)
                || !node_by_id.contains_key(&edge.to.node_id)
            {
                continue;
            }

            let target = node_by_id[&edge.to.node_id];
            let is_loop_back =
                self.allowed_loop_types.contains(&target.r#type) && edge.to.input_index >= 1;

            if !is_loop_back {
                if let Some(outs) = adj.get_mut(&edge.from.node_id) {
                    outs.push(edge.to.node_id.clone());
                }
            }
        }
        adj
    }

    pub fn validate(&self) -> Result<(), Vec<DagError>> {
        let mut errors = Vec::new();
        let node_by_id: HashMap<String, &IRNode> =
            self.graph.nodes.iter().map(|n| (n.id.clone(), n)).collect();

        // 1. Edge endpoints
        for edge in &self.graph.edges {
            if !node_by_id.contains_key(&edge.from.node_id) {
                errors.push(DagError::EdgeFromUnknownNode(edge.from.node_id.clone()));
            }
            if !node_by_id.contains_key(&edge.to.node_id) {
                errors.push(DagError::EdgeToUnknownNode(edge.to.node_id.clone()));
            }
        }

        // 2. Triggers
        if self.graph.triggers.is_empty() {
            errors.push(DagError::NoTrigger);
        }
        for trigger in &self.graph.triggers {
            if !node_by_id.contains_key(&trigger.node_id) {
                errors.push(DagError::TriggerUnknownNode(trigger.node_id.clone()));
            }
        }

        // 3. Type Version
        for node in &self.graph.nodes {
            if !node.type_version.is_finite() {
                errors.push(DagError::MissingTypeVersion(node.id.clone()));
            }
        }

        // 4. Cycle detection
        if let Some(cycle) = self.find_cycle(&node_by_id) {
            errors.push(DagError::CycleDetected(cycle));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    fn find_cycle(&self, _node_by_id: &HashMap<String, &IRNode>) -> Option<Vec<String>> {
        let adj = self.build_dag_adjacency();
        let mut color: HashMap<String, u8> = HashMap::new();
        let mut stack: Vec<String> = Vec::new();

        const WHITE: u8 = 0;

        for node in &self.graph.nodes {
            color.insert(node.id.clone(), WHITE);
        }

        for node in &self.graph.nodes {
            if *color.get(&node.id).unwrap_or(&WHITE) == WHITE {
                if let Some(cycle) = Self::visit(&node.id, &adj, &mut color, &mut stack) {
                    return Some(cycle);
                }
            }
        }
        None
    }

    fn visit(
        id: &str,
        adj: &HashMap<String, Vec<String>>,
        color: &mut HashMap<String, u8>,
        stack: &mut Vec<String>,
    ) -> Option<Vec<String>> {
        const WHITE: u8 = 0;
        const GRAY: u8 = 1;
        const BLACK: u8 = 2;

        color.insert(id.to_string(), GRAY);
        stack.push(id.to_string());

        if let Some(neighbors) = adj.get(id) {
            for nxt in neighbors {
                let c = *color.get(nxt).unwrap_or(&WHITE);
                if c == GRAY {
                    if let Some(start_idx) = stack.iter().position(|x| x == nxt) {
                        let mut cycle = stack[start_idx..].to_vec();
                        cycle.push(nxt.clone());
                        return Some(cycle);
                    }
                }
                if c == WHITE {
                    if let Some(found) = Self::visit(nxt, adj, color, stack) {
                        return Some(found);
                    }
                }
            }
        }

        stack.pop();
        color.insert(id.to_string(), BLACK);
        None
    }

    pub fn topo_sort(&self) -> Result<Vec<IRNode>, DagError> {
        let adj = self.build_dag_adjacency();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for node in &self.graph.nodes {
            in_degree.insert(node.id.clone(), 0);
        }

        for outs in adj.values() {
            for dst in outs {
                *in_degree.entry(dst.clone()).or_insert(0) += 1;
            }
        }

        let mut queue: VecDeque<String> = VecDeque::new();
        // Seed queue in original node order to ensure stable sort.
        for node in &self.graph.nodes {
            if *in_degree.get(&node.id).unwrap_or(&0) == 0 {
                queue.push_back(node.id.clone());
            }
        }

        let mut out: Vec<IRNode> = Vec::new();
        let node_by_id: HashMap<String, IRNode> = self
            .graph
            .nodes
            .iter()
            .map(|n| (n.id.clone(), n.clone()))
            .collect();

        while let Some(id) = queue.pop_front() {
            if let Some(node) = node_by_id.get(&id) {
                out.push(node.clone());
            }
            if let Some(outs) = adj.get(&id) {
                for dst in outs {
                    let degree = in_degree.get_mut(dst).unwrap();
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push_back(dst.clone());
                    }
                }
            }
        }

        if out.len() != self.graph.nodes.len() {
            // Cycle detected, find the cycle path to return in the error
            let node_ref_by_id = self.graph.nodes.iter().map(|n| (n.id.clone(), n)).collect();
            let cycle = self.find_cycle(&node_ref_by_id).unwrap_or_default();
            Err(DagError::CycleDetected(cycle))
        } else {
            Ok(out)
        }
    }
}
