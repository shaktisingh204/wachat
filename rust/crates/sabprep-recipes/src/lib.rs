//! # sabprep-recipes
//!
//! Recipe entity + HTTP surface. A "recipe" is a saved, ordered list of
//! transformation steps applied to a source row-set.
//!
//! Routes (mount at `/v1/sabprep/recipes`):
//! ```text
//! GET    /                — list_recipes
//! POST   /                — create_recipe
//! GET    /{recipeId}      — get_recipe
//! PATCH  /{recipeId}      — update_recipe
//! DELETE /{recipeId}      — delete_recipe (soft → status: archived)
//! POST   /{recipeId}/run  — execute the recipe and persist a run + output
//! POST   /preview         — bounded ad-hoc preview (rows + steps in body)
//! ```
//!
//! See `sabprep-steps` for the step DTO catalog + execution engine.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
