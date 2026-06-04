//! Status vocabularies for workflow runs and their steps, modelled on
//! Twenty's `WorkflowRunStatus` / step `StepStatus`.
//!
//! These enums exist so the HTTP surface can **normalize** the free-form
//! `status` strings callers send into a stable canonical form and reject
//! obviously-invalid values — without changing the verbatim-JSON storage
//! contract. Both Twenty's vocabulary (`RUNNING` / `COMPLETED` / `FAILED`
//! / `STOPPED` / `NOT_STARTED`) and the SabCRM aliases used elsewhere in
//! the stack (`running` / `success` / `failed`) are accepted on input and
//! collapsed to one canonical wire token.
//!
//! Canonical wire tokens (what we persist + return):
//!
//! | Run status   | Step status   |
//! |--------------|---------------|
//! | `not_started`| `not_started` |
//! | `running`    | `pending`     |
//! | `success`    | `running`     |
//! | `failed`     | `success`     |
//! | `stopped`    | `failed`      |

use sabnode_common::{ApiError, Result};

/// Lifecycle status of a whole workflow run.
///
/// Twenty calls the terminal-success state `COMPLETED`; SabCRM has long
/// used `success`. We accept both and canonicalize to `success` so the
/// task-mandated `running` | `success` | `failed` trio is always present,
/// while still tolerating Twenty's `COMPLETED` / `STOPPED` / `NOT_STARTED`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunStatus {
    /// Created but not yet picked up by a runner.
    NotStarted,
    /// Actively executing.
    Running,
    /// Finished successfully (Twenty: `COMPLETED`).
    Success,
    /// Finished with an error.
    Failed,
    /// Aborted before completing.
    Stopped,
}

impl RunStatus {
    /// Parse a caller-supplied status string, case-insensitively, accepting
    /// both Twenty and SabCRM spellings. Returns `None` for unknown values.
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "not_started" | "notstarted" | "not-started" => Some(Self::NotStarted),
            "running" | "in_progress" | "inprogress" => Some(Self::Running),
            "success" | "succeeded" | "completed" | "complete" | "done" => Some(Self::Success),
            "failed" | "failure" | "error" | "errored" => Some(Self::Failed),
            "stopped" | "aborted" | "cancelled" | "canceled" => Some(Self::Stopped),
            _ => None,
        }
    }

    /// Canonical lowercase wire token.
    pub fn as_wire(self) -> &'static str {
        match self {
            Self::NotStarted => "not_started",
            Self::Running => "running",
            Self::Success => "success",
            Self::Failed => "failed",
            Self::Stopped => "stopped",
        }
    }

    /// Whether this is an end state (run has finished, one way or another).
    /// Terminal runs get a `finishedAt` stamp; non-terminal runs do not.
    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Success | Self::Failed | Self::Stopped)
    }
}

/// Execution status of a single step within a run, modelled on Twenty's
/// per-step `StepStatus`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepStatus {
    /// Not yet reached.
    NotStarted,
    /// Queued / waiting (e.g. delay, form).
    Pending,
    /// Currently executing.
    Running,
    /// Finished successfully.
    Success,
    /// Finished with an error.
    Failed,
}

impl StepStatus {
    /// Parse a caller-supplied step status string, case-insensitively.
    /// Returns `None` for unknown values.
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "not_started" | "notstarted" | "not-started" => Some(Self::NotStarted),
            "pending" | "waiting" | "queued" => Some(Self::Pending),
            "running" | "in_progress" | "inprogress" => Some(Self::Running),
            "success" | "succeeded" | "completed" | "complete" | "done" => Some(Self::Success),
            "failed" | "failure" | "error" | "errored" => Some(Self::Failed),
            _ => None,
        }
    }

    /// Canonical lowercase wire token.
    pub fn as_wire(self) -> &'static str {
        match self {
            Self::NotStarted => "not_started",
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Success => "success",
            Self::Failed => "failed",
        }
    }
}

/// Validate + canonicalize a run-level `status` value. `None` input is
/// passed through (caller decides the default); a present-but-invalid
/// value is a `422`.
pub fn normalize_run_status(raw: Option<&str>) -> Result<Option<&'static str>> {
    match raw {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => RunStatus::parse(s).map(|st| Some(st.as_wire())).ok_or_else(|| {
            ApiError::Validation(format!(
                "invalid run status {s:?}; expected one of running|success|failed|stopped|not_started."
            ))
        }),
    }
}

/// Validate + canonicalize a step-level `status` value. Empty / missing
/// defaults to `not_started`; a present-but-invalid value is a `422`.
pub fn normalize_step_status(raw: Option<&str>) -> Result<&'static str> {
    match raw {
        None => Ok(StepStatus::NotStarted.as_wire()),
        Some(s) if s.trim().is_empty() => Ok(StepStatus::NotStarted.as_wire()),
        Some(s) => StepStatus::parse(s).map(StepStatus::as_wire).ok_or_else(|| {
            ApiError::Validation(format!(
                "invalid step status {s:?}; expected one of not_started|pending|running|success|failed."
            ))
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_status_aliases_canonicalize() {
        assert_eq!(RunStatus::parse("COMPLETED"), Some(RunStatus::Success));
        assert_eq!(RunStatus::parse("success"), Some(RunStatus::Success));
        assert_eq!(RunStatus::parse("Running"), Some(RunStatus::Running));
        assert_eq!(RunStatus::parse("error"), Some(RunStatus::Failed));
        assert_eq!(RunStatus::parse("ABORTED"), Some(RunStatus::Stopped));
        assert_eq!(RunStatus::parse("bogus"), None);
    }

    #[test]
    fn run_status_terminality() {
        assert!(!RunStatus::Running.is_terminal());
        assert!(!RunStatus::NotStarted.is_terminal());
        assert!(RunStatus::Success.is_terminal());
        assert!(RunStatus::Failed.is_terminal());
        assert!(RunStatus::Stopped.is_terminal());
    }

    #[test]
    fn step_status_defaults_and_rejects() {
        assert_eq!(normalize_step_status(None).unwrap(), "not_started");
        assert_eq!(normalize_step_status(Some("")).unwrap(), "not_started");
        assert_eq!(normalize_step_status(Some("SUCCESS")).unwrap(), "success");
        assert!(normalize_step_status(Some("nope")).is_err());
    }
}
