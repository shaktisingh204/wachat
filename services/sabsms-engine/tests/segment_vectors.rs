//! Anti-drift artifact (plan §V2.1): the SAME fixture JSON is consumed
//! by this cargo test and by the Next.js vitest suite for
//! `src/lib/sabsms/segments.ts`, so the TS counter can never silently
//! diverge from the engine-billed segment count.
//!
//! The fixture is produced by the Next-side agent. When it doesn't
//! exist yet this test SKIPS (with an eprintln) so `cargo test` stays
//! green either way.

use std::path::PathBuf;

use sabsms_engine::providers::{encoding_of, estimate_segments};

#[derive(serde::Deserialize)]
struct Vector {
    body: String,
    segments: u32,
    encoding: String,
}

#[test]
fn segment_vectors_match_engine_counter() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("segment-vectors.json");

    if !path.exists() {
        eprintln!(
            "SKIP segment_vectors_match_engine_counter: fixture not present at {}",
            path.display()
        );
        return;
    }

    let raw = std::fs::read_to_string(&path).expect("reading segment-vectors.json");
    let vectors: Vec<Vector> = serde_json::from_str(&raw).expect("parsing segment-vectors.json");
    assert!(!vectors.is_empty(), "fixture must contain at least one vector");

    let mut failures = Vec::new();
    for (i, v) in vectors.iter().enumerate() {
        let got_segments = estimate_segments(&v.body);
        let got_encoding = encoding_of(&v.body);
        if got_segments != v.segments {
            failures.push(format!(
                "vector {i}: segments mismatch — expected {}, got {} (body {:?})",
                v.segments, got_segments, v.body
            ));
        }
        if got_encoding != v.encoding {
            failures.push(format!(
                "vector {i}: encoding mismatch — expected {:?}, got {:?} (body {:?})",
                v.encoding, got_encoding, v.body
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} vectors failed:\n{}",
        failures.len(),
        vectors.len(),
        failures.join("\n")
    );
}
