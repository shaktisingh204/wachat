# Vendored crates

## ironcalc-base / ironcalc
- Origin: https://github.com/ironcalc/IronCalc
- Version: v0.7.1 (tag), vendored 2026-06-12
- License: dual MIT / Apache-2.0 (LICENSE-MIT + LICENSE-Apache-2.0 preserved in each crate)
- Why vendored: SabSheet extends the engine with additional clean-room spreadsheet
  functions (implemented from Microsoft's public function documentation / ODF
  OpenFormula spec). Local modifications are confined to `src/functions/` plus the
  registration tables; upstreamable.
