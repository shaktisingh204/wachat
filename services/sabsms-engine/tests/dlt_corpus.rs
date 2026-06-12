//! V2.8 anti-drift contract for the DLT scrub simulator.
//!
//! `fixtures/dlt-corpus.json` holds 50+ operator-style cases — the SAME
//! fixture is read by the Next.js test suite
//! (`src/app/sabsms/compliance/dlt/__tests__/wire.test.ts`) so the TS
//! registry schemas and the Rust matcher can never silently diverge.
//!
//! Each case:
//! ```json
//! {
//!   "name": "unique label",
//!   "registeredBody": "Your OTP is {#var#}.",
//!   "messageBody": "Your OTP is 482913.",
//!   "expect": "pass" | "fail",
//!   "failCheck": "var_too_long"   // optional — asserted only when present
//! }
//! ```
//!
//! `failCheck` is optional because the named check on a failure is a
//! best-effort greedy diagnosis (dlt.rs assumption #6); cases whose
//! diagnosis is implementation-quirky assert only pass/fail.

use std::collections::HashSet;
use std::path::PathBuf;

use sabsms_engine::compliance::dlt::{scrub, ScrubResult};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Case {
    name: String,
    registered_body: String,
    message_body: String,
    expect: String,
    #[serde(default)]
    fail_check: Option<String>,
}

#[test]
fn dlt_corpus_matches_scrub_simulator() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("dlt-corpus.json");

    let raw = std::fs::read_to_string(&path).expect("reading dlt-corpus.json");
    let cases: Vec<Case> = serde_json::from_str(&raw).expect("parsing dlt-corpus.json");

    assert!(
        cases.len() >= 50,
        "corpus must hold at least 50 cases, found {}",
        cases.len()
    );

    let mut names: HashSet<&str> = HashSet::new();
    let mut failures: Vec<String> = Vec::new();

    for c in &cases {
        assert!(
            names.insert(c.name.as_str()),
            "duplicate corpus case name: {}",
            c.name
        );
        assert!(
            c.expect == "pass" || c.expect == "fail",
            "case {:?}: expect must be \"pass\" or \"fail\"",
            c.name
        );
        if c.expect == "pass" {
            assert!(
                c.fail_check.is_none(),
                "case {:?}: failCheck is meaningless on a pass case",
                c.name
            );
        }

        let got = scrub(&c.registered_body, &c.message_body);
        match (c.expect.as_str(), &got) {
            ("pass", ScrubResult::Pass) => {}
            ("fail", ScrubResult::Fail { check, detail }) => {
                if let Some(want) = &c.fail_check {
                    if want != check {
                        failures.push(format!(
                            "{}: expected failCheck {want}, got {check} ({detail})",
                            c.name
                        ));
                    }
                }
            }
            ("pass", ScrubResult::Fail { check, detail }) => {
                failures.push(format!(
                    "{}: expected pass, got fail {check} ({detail})",
                    c.name
                ));
            }
            ("fail", ScrubResult::Pass) => {
                failures.push(format!("{}: expected fail, got pass", c.name));
            }
            _ => unreachable!(),
        }
    }

    assert!(
        failures.is_empty(),
        "{} corpus case(s) diverged:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
