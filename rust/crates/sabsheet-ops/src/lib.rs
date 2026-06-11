//! # sabsheet-ops
//!
//! Authoritative op-apply endpoint for SabSheet v2. Applies intent-based [`Command`] batches to a
//! server-side [`SabEngine`], persists the workbook snapshot + op log, and returns the engine diff
//! blob for clients to replay and (later) broadcast over the collab gateway.
//!
//! [`Command`]: sabsheet_engine::ops::Command
//! [`SabEngine`]: sabsheet_engine::SabEngine

pub mod cache;
pub mod docs;
pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;

#[cfg(test)]
mod tests {
    use sabsheet_engine::SabEngine;
    use sabsheet_engine::ops::Command;

    /// Compile-time `Send` probe. This compiling is the verdict: **`SabEngine` IS `Send`** (it wraps
    /// IronCalc's `UserModel`, which carries no `Rc`/`RefCell` across its public surface). Because
    /// the engine is `Send`, the in-process LRU engine cache in [`crate::cache`] can safely live in
    /// shared Axum state. If a future IronCalc bump made `SabEngine` non-`Send`, this line would stop
    /// compiling — a loud signal to fall back to per-request `from_snapshot` (or an actor design).
    #[allow(dead_code)]
    fn _assert_send<T: Send>() {}

    #[test]
    fn send_verdict() {
        let _ = _assert_send::<SabEngine>;
        let _ = SabEngine::new("probe").unwrap();
    }

    /// Mirrors the migrate handler's engine logic (without Mongo): build a fresh engine, add a
    /// second sheet, rename both, populate cells in batches, and check a formula evaluates.
    #[test]
    fn migrate_logic_builds_multi_sheet_workbook() {
        let mut engine = SabEngine::new("wb").unwrap();

        // Sheet 0: rename + cells incl. a SUM formula.
        engine
            .apply(&[Command::RenameSheet { sheet: 0, name: "Revenue".into() }])
            .unwrap();
        engine
            .apply(&[
                Command::SetCellInput { sheet: 0, row: 1, col: 1, input: "10".into() },
                Command::SetCellInput { sheet: 0, row: 2, col: 1, input: "20".into() },
                Command::SetCellInput { sheet: 0, row: 3, col: 1, input: "=SUM(A1:A2)".into() },
            ])
            .unwrap();

        // Sheet 1: NewSheet + rename + a literal.
        engine.apply(&[Command::NewSheet]).unwrap();
        engine
            .apply(&[Command::RenameSheet { sheet: 1, name: "Notes".into() }])
            .unwrap();
        engine
            .apply(&[Command::SetCellInput { sheet: 1, row: 1, col: 1, input: "hello".into() }])
            .unwrap();

        assert_eq!(engine.sheet_count(), 2);
        assert_eq!(engine.formatted(0, 3, 1).unwrap(), "30");
        assert_eq!(engine.formatted(1, 1, 1).unwrap(), "hello");

        // Snapshot round-trips (the value the migrate handler persists).
        let snap = engine.to_snapshot();
        let restored = SabEngine::from_snapshot(&snap).unwrap();
        assert_eq!(restored.formatted(0, 3, 1).unwrap(), "30");
    }
}
