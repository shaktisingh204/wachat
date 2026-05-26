//! Request / response DTOs for the recipe endpoints.

use sabprep_steps::{Row, Step, StepRunSummary};
use serde::{Deserialize, Serialize};

use crate::types::SabprepRecipe;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecipeInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Hex ObjectId.
    #[serde(default)]
    pub source_dataset_id: Option<String>,
    #[serde(default)]
    pub source_columns: Vec<String>,
    #[serde(default)]
    pub steps: Vec<Step>,
    #[serde(default)]
    pub schedule_cron: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecipeInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub source_dataset_id: Option<String>,
    #[serde(default)]
    pub source_columns: Option<Vec<String>>,
    #[serde(default)]
    pub steps: Option<Vec<Step>>,
    #[serde(default)]
    pub schedule_cron: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabprepRecipe>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecipeResponse {
    pub id: String,
    pub entity: SabprepRecipe,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecipeResponse {
    pub deleted: bool,
}

// ─── Preview / Run ──────────────────────────────────────────────────────

/// `POST /preview` — apply steps to an in-band row sample. Used by the
/// canvas to show output after each step without persisting anything.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewInput {
    pub rows: Vec<Row>,
    pub steps: Vec<Step>,
    /// Cap the rows returned to the UI (bounded preview).
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub rows: Vec<Row>,
    pub summaries: Vec<StepRunSummary>,
    pub total_errors: u32,
    /// Rows truncated to `limit`. Total kept separately.
    pub rows_total: u32,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecipeInput {
    /// Optional override — when present, run with these in-band rows
    /// instead of fetching `source_dataset_id`. Useful for "Run with sample".
    #[serde(default)]
    pub rows: Option<Vec<Row>>,
    /// If true, write the output to `sabprep_outputs`. Defaults true.
    #[serde(default = "default_true")]
    pub persist_output: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecipeResponse {
    pub run_id: String,
    pub output_dataset_id: Option<String>,
    pub rows_in: u32,
    pub rows_out: u32,
    pub status: String,
    pub summaries: Vec<StepRunSummary>,
}
