//! Dump every formula-function name the engine accepts, one per line (for the parity audit and
//! the autocomplete catalog). Union of:
//! - canonical names from `SabEngine::function_names()` (the `Function` enum), and
//! - every name the parser's lookup accepts in the English pack — this includes the legacy
//!   `*_compat` aliases (e.g. NORMDIST → NORM.DIST) that don't appear in the enum iteration.
use std::collections::BTreeSet;

fn main() {
    let mut names: BTreeSet<String> = sabsheet_engine::SabEngine::function_names()
        .into_iter()
        .collect();

    // The en language pack's `functions` struct values are exactly the accepted spellings.
    let lang = ironcalc_base::language::get_language("en").expect("en language pack");
    if let Ok(serde_json::Value::Object(map)) = serde_json::to_value(&lang.functions) {
        for v in map.values() {
            if let serde_json::Value::String(s) = v {
                names.insert(s.clone());
            }
        }
    }

    for n in names {
        println!("{n}");
    }
}
