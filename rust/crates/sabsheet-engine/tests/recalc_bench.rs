//! Scale benchmark for the IronCalc recalc path (P0 open item #3: incremental recalc at scale).
//!
//! Not a correctness test — it prints timings. Run explicitly:
//!   cargo test -p sabsheet-engine --release --test recalc_bench -- --ignored --nocapture

use sabsheet_engine::SabEngine;
use sabsheet_engine::ops::Command;
use std::time::Instant;

fn set(sheet: u32, row: i32, col: i32, input: &str) -> Command {
    Command::SetCellInput { sheet, row, col, input: input.to_string() }
}

#[test]
#[ignore]
fn recalc_chain_100k() {
    // Build a 100k-row dependency chain: A1=1, An = A(n-1)+1. A single edit at the head must
    // propagate through the whole chain — the worst case for a dependency-graph recalc.
    const N: i32 = 100_000;
    let mut e = SabEngine::new("bench").unwrap();

    let t_build = Instant::now();
    let mut batch = Vec::with_capacity(N as usize);
    batch.push(set(0, 1, 1, "1"));
    for r in 2..=N {
        batch.push(set(0, r, 1, &format!("=A{}+1", r - 1)));
    }
    e.apply(&batch).unwrap();
    let build_ms = t_build.elapsed().as_millis();

    let tail = e.formatted(0, N, 1).unwrap();
    println!("build {N} formulas: {build_ms} ms; tail A{N} = {tail}");
    assert_eq!(tail, N.to_string());

    // Single head edit -> full-chain recalc.
    let t_edit = Instant::now();
    e.apply(&[set(0, 1, 1, "1000")]).unwrap();
    let edit_ms = t_edit.elapsed().as_millis();
    let tail2 = e.formatted(0, N, 1).unwrap();
    println!("head edit -> recalc {N} deep: {edit_ms} ms; tail A{N} = {tail2}");
    assert_eq!(tail2, (N + 999).to_string());

    // Viewport read of a 50x32 window (the grid's hot path) from the middle of the sheet.
    let t_vp = Instant::now();
    let cells = e
        .read_viewport(sabsheet_engine::ops::RangeRef {
            sheet: 0,
            row: 50_000,
            col: 1,
            width: 32,
            height: 50,
        })
        .unwrap();
    let vp_us = t_vp.elapsed().as_micros();
    println!("viewport read 50x32: {vp_us} us ({} non-empty cells)", cells.len());
}

#[test]
#[ignore]
fn recalc_wide_sum_50k() {
    // 50k independent SUM formulas each over a 10-cell range — tests breadth, not depth.
    const N: i32 = 50_000;
    let mut e = SabEngine::new("bench").unwrap();
    let mut batch = Vec::new();
    for r in 1..=10 {
        batch.push(set(0, r, 1, &r.to_string()));
    }
    for r in 1..=N {
        batch.push(set(0, r, 3, "=SUM(A1:A10)"));
    }
    let t = Instant::now();
    e.apply(&batch).unwrap();
    println!("build+eval {N} SUM formulas: {} ms", t.elapsed().as_millis());
    assert_eq!(e.formatted(0, N, 3).unwrap(), "55");

    let t2 = Instant::now();
    e.apply(&[set(0, 1, 1, "100")]).unwrap();
    println!("edit A1 -> recalc {N} dependents: {} ms", t2.elapsed().as_millis());
    assert_eq!(e.formatted(0, N, 3).unwrap(), "154");
}
