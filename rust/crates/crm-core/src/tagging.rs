//! `tags[]` — denormalized list of tag names/ids the entity is currently
//! tagged with. Tags themselves live in their own (TBD) collection;
//! this is the pointer list, mirroring the TS string-array shape.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Tags(pub Vec<String>);

impl Tags {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn push(&mut self, tag: impl Into<String>) {
        self.0.push(tag.into());
    }
    pub fn iter(&self) -> std::slice::Iter<'_, String> {
        self.0.iter()
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
    pub fn len(&self) -> usize {
        self.0.len()
    }
}

impl<S: Into<String>> FromIterator<S> for Tags {
    fn from_iter<I: IntoIterator<Item = S>>(iter: I) -> Self {
        Self(iter.into_iter().map(Into::into).collect())
    }
}
