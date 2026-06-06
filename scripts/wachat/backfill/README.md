# WaChat completion campaign — data backfill scripts

Idempotent, dry-run-by-default migration scripts that copy/transform **legacy
native-Mongo rows** into the **new Rust-crate collections** (`wa_*`) introduced
during the WaChat completion campaign.

All scripts:

- **Dry-run by default** — they only log what they *would* write.
- **`--apply`** — pass this flag to actually write.
- **Idempotent** — re-running is safe; rows already migrated (matched by a
  natural key, the preserved `_id`) are skipped. No duplicates, no clobbering.
- Connect via the project's `connectToDatabase` helper (`src/lib/mongodb.ts`),
  reading `MONGODB_URI` / `MONGODB_DB` from `.env`.

## Running

```bash
# from the repo root
npx tsx scripts/wachat/backfill/canned-messages.ts            # dry-run
npx tsx scripts/wachat/backfill/canned-messages.ts --apply    # write for real
```

Always run the dry-run first, eyeball the counts and any `SKIP` warnings, then
re-run with `--apply`.

Requires `MONGODB_URI` and `MONGODB_DB` in `.env` at the repo root (the scripts
load it with `dotenv`). You can also `export` them before running.

---

## What got a script, and why

I compared every candidate feature's **legacy native-Mongo collection** against
the **new Rust-crate collection** it was replaced by. A backfill is only needed
where there was a genuine **collection RENAME and/or a scoping change** (e.g. a
new `userId` filter). Where the crate simply reuses the same collection, there
is **nothing to migrate**.

### ✅ `canned-messages.ts` — RENAME + new `userId` scoping (NEEDS backfill)

| | legacy | new |
|---|---|---|
| Collection | `canned_messages` | `wa_canned_messages` |
| Scoped by | `projectId` only | `userId` **+** `projectId` |
| `createdBy` | `session.user.name` (display name) | `userId` hex string |
| Extra fields | — | `userId` (ObjectId), `updatedAt` |
| Owner of write path | `src/app/actions/project.actions.ts` (`saveCannedMessageAction`) | `rust/crates/wachat-canned-messages` (`/v1/wachat/canned-messages`), via `src/app/actions/wachat-canned-messages.actions.ts` |

The new read path (`getCannedMessages`) filters on `{ userId, projectId }`, so
any legacy `canned_messages` row is **invisible** until copied into
`wa_canned_messages` with the correct `userId` (resolved from
`projects.userId`). The script:

- preserves the original `_id` (natural key → idempotency),
- resolves `userId` from `projects.userId` (cached per project),
- rewrites `createdBy` to the userId hex (matching the crate),
- adds `updatedAt`,
- skips orphan rows (project deleted / project has no `userId`) with a warning,
- skips rows already present in `wa_canned_messages`.

> Note: the crate's sibling collection `wa_canned_message_settings`
> (`syncAcrossProjects` / `keyboardTrigger`) is a **net-new feature** — it has no
> legacy source, so there is nothing to backfill there.

---

## Investigated and found NOT to need a script

These were checked per the task and deliberately **excluded** — the crate reuses
the legacy collection name with no scoping change, or the feature was never
migrated to a crate at all.

| Feature | Legacy collection | Crate collection | Verdict |
|---|---|---|---|
| **Media meta** | `wachat_media_meta` (`src/app/wachat/media-library/actions.ts`) | *(none)* | `wachat-media` crate is a pure R2 **download/upload** service — it stores **no** Mongo meta. The legacy `wachat_media_meta` collection is untouched and still owns the metadata. **No rename → no migration.** |
| **Link clicks** | `wa_link_clicks` | `wa_link_clicks` | The `wachat-link-generator` crate's own docs say this is the *"**existing** collection"* (`handlers.rs`), same name, same scoping. Legacy native action already wrote `wa_link_clicks`. **Same collection reused → no migration.** |
| **Chatbots** | `whatsapp_bots` (`src/app/actions/marketing/whatsapp-chatbots.actions.ts`) | *(none)* | No Rust crate references `whatsapp_bots`. The feature was **not** migrated. **Nothing to migrate.** |
| **Auto-reply rules** | `wa_auto_reply_rules` | `wa_auto_reply_rules` | Both the legacy native action (`src/app/wachat/auto-reply-rules/actions.ts`) and the crate (`rust/crates/wachat-features/src/messaging/auto_reply.rs`) use the **same** collection name and scope by `projectId` (the crate does **not** add `userId` scoping). **Same collection, same scoping → no migration.** |
| `projects` and similar shared collections | reused verbatim by the crates | — | Same collection reused → never migrate. |

---

## Adding more backfills later

If a future crate genuinely renames a collection or adds a scoping field, add a
new `scripts/wachat/backfill/<feature>.ts` following `canned-messages.ts`:

1. dry-run by default, `--apply` to write;
2. preserve the legacy `_id` so re-runs are idempotent;
3. resolve any new scoping field (e.g. `userId`) from `projects.userId`;
4. log SKIP warnings for orphans instead of guessing;
5. document the legacy→new shape mapping in the file header and this README.
