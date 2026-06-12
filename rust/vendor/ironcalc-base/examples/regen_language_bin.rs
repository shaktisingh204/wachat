//! SabNode vendored addition: regenerate `src/language/language.bin` from `language.json`.
//!
//! The engine loads function/error/boolean names from the bitcode-encoded blob, so any time a
//! function entry is added to `language.json` (e.g. new clean-room functions or legacy-name
//! aliases) this must be re-run:
//!
//! ```sh
//! cargo run -p ironcalc_base --example regen_language_bin
//! ```

use std::collections::HashMap;
use std::fs;

use ironcalc_base::language::Language;

fn main() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/src/language");
    let json = fs::read_to_string(format!("{dir}/language.json")).expect("read language.json");
    let langs: HashMap<String, Language> =
        serde_json::from_str(&json).expect("parse language.json");
    let bin = bitcode::encode(&langs);

    // Sanity: the bytes we are about to write must decode back to the same language set.
    let decoded: HashMap<String, Language> = bitcode::decode(&bin).expect("round-trip decode");
    assert_eq!(decoded.len(), langs.len());
    assert!(decoded.contains_key("en"), "english language pack missing");

    fs::write(format!("{dir}/language.bin"), &bin).expect("write language.bin");
    println!("wrote {} bytes for {} languages", bin.len(), langs.len());
}
