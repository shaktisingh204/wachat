//! `customFields{}` — opaque per-entity bag driven by the project's
//! custom-fields metadata (see `src/lib/worksuite/meta-types.ts`). Values
//! are heterogeneous (string, number, bool, ObjectId for `entity_ref`,
//! array, …) so we store them as `serde_json::Value`. Domain crates that
//! need typed views narrow at their own boundary.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CustomFields(pub BTreeMap<String, serde_json::Value>);

impl CustomFields {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.0.get(key)
    }
    pub fn insert(&mut self, key: impl Into<String>, value: serde_json::Value) {
        self.0.insert(key.into(), value);
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
    pub fn len(&self) -> usize {
        self.0.len()
    }
}
