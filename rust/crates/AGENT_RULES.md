# Rust DTO Agent Rules — Read this first.

You are writing pure-data DTOs for the SabNode CRM Rust port. The work is pure types — no I/O, no async, no business logic.

## Reference pattern (copy this style exactly)

`/Users/harshkhandelwal/Downloads/sabnode/rust/crates/crm-sales-types/src/quotation.rs`

That file is the canonical example: flattened `crm-core` fragments, camelCase serde, snake_case multi-word enum variants, optional fields with `skip_serializing_if`, inline `#[cfg(test)]` round-trip test.

Also useful for shape inspiration:
- `rust/crates/crm-sales-types/src/client.rs` — long entity with many optional fields
- `rust/crates/crm-sales-types/src/invoice.rs` — recurring config + envelope sub-types
- `rust/crates/crm-purchases-types/src/bill.rs` — entity with two coexisting line-vector flavors

## Conventions (every agent must follow)

1. Every struct: `#[derive(Debug, Clone, Serialize, Deserialize)]` + `#[serde(rename_all = "camelCase")]`.
2. **Flatten cross-cutting `crm-core` fragments at the top of the struct** so the document root carries §0 fields directly. Use these where applicable:
   - `Identity` (always — `_id`, `projectId`, `userId`, `tenantId`)
   - `Audit` (always — `createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
   - `Assignment` (when the entity has assignedTo / teamId / pipelineId / stageId)
   - `Attribution` (when the entity has source / utm)
   - `LineageRef` is the helper used in `Vec<LineageRef>` lineage fields, not flattened.
3. Field types:
   - IDs: `bson::oid::ObjectId`
   - Timestamps: `chrono::DateTime<Utc>`
   - Money: `f64` (matches TS Number JSON shape)
   - Percentages stored as integers / small floats: `f32` for percentages, `u8` for 1-5 rating, `u32` for day counts
4. Optional fields: `#[serde(default, skip_serializing_if = "Option::is_none")]`. Empty `Vec`: `#[serde(default, skip_serializing_if = "Vec::is_empty")]`. Default-`false` `bool`: helper `fn is_false(b: &bool) -> bool { !*b }`.
5. Enums:
   - Derive `Default` with `#[default]` on the natural-default variant.
   - Single-word variants: `#[serde(rename_all = "lowercase")]`
   - Multi-word variants: `#[serde(rename_all = "snake_case")]`
6. Free-form status strings: use a transparent newtype `pub struct Status(pub String)` like `crm-core::Status`.

## Allowed imports

```rust
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crm_core::{Assignment, Attachment, Attribution, Audit, CustomFields, Identity, LineageRef, Note, Tags};
use crm_sales_types::{Address, ContactBook, ContactChannel, DeliveryOutcome, EmailLog, LineItem, OpeningBalance, PaymentMode, PdfStatus, RecurringConfig, RefundMode, TaxPreference, Totals, WhatsAppSendLog};
```

Pull only what your module actually uses.

## Tests

Every module ends with:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_with_flattened_fragments() {
        // Build a minimal value, serialize to JSON, assert:
        //   - "_id", "projectId", "userId" exist at root (flattened)
        //   - "identity" / "audit" do NOT exist as nested keys
        //   - camelCase fields appear (e.g. "createdAt", entity-specific names)
        //   - Status / enum fields serialize lowercase or snake_case as configured
        // Then deserialize back and assert at least one field round-trips.
    }
}
```

Add one test per top-level entity struct. If the module has 3 entities, write 3 tests.

## Forbidden actions

- Do **NOT** modify any `lib.rs` file (the integrator wires modules after all agents return).
- Do **NOT** modify any `Cargo.toml` file.
- Do **NOT** run `cargo check` / `cargo test` / `cargo clippy`. The parent crate's lib.rs has not declared your module yet, so cargo will fail. Trust your code; the integrator runs final verification.
- Do **NOT** create files outside the assigned paths.

## Output

When done, return: the file paths you wrote (with line counts), and a 2-line note on any non-obvious modeling choices you made. Nothing else.
