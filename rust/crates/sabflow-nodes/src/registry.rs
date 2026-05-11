//! Node registry — runtime lookup of nodes by name.

use std::collections::HashMap;
use std::sync::Arc;

use crate::node::Node;

pub struct NodeRegistry {
    by_name: HashMap<String, Arc<dyn Node>>,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            by_name: HashMap::new(),
        }
    }

    pub fn register<N: Node + 'static>(&mut self, node: N) -> &mut Self {
        let name = node.descriptor().name.clone();
        self.by_name.insert(name, Arc::new(node));
        self
    }

    pub fn register_arc(&mut self, node: Arc<dyn Node>) -> &mut Self {
        let name = node.descriptor().name.clone();
        self.by_name.insert(name, node);
        self
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Node>> {
        self.by_name.get(name).cloned()
    }

    pub fn names(&self) -> Vec<String> {
        let mut v: Vec<String> = self.by_name.keys().cloned().collect();
        v.sort();
        v
    }

    pub fn descriptors(&self) -> Vec<crate::descriptor::NodeDescriptor> {
        let mut v: Vec<_> = self.by_name.values().map(|n| n.descriptor()).collect();
        v.sort_by(|a, b| a.name.cmp(&b.name));
        v
    }

    pub fn len(&self) -> usize {
        self.by_name.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_name.is_empty()
    }
}

impl Default for NodeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Build the registry with every node sabflow knows about — both fully
/// implemented nodes and stubs.  Called once at server startup.
pub fn default_registry() -> NodeRegistry {
    let mut r = NodeRegistry::new();
    crate::nodes::register_all(&mut r);
    r
}
