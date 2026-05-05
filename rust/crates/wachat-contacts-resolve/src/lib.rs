//! # wachat-contacts-resolve
//!
//! **Find-or-create contact resolver** — Phase 4, slice 5 of the SabNode
//! TS-to-Rust port.
//!
//! Ports `findOrCreateContact` from `src/app/actions/whatsapp.actions.ts`
//! (line 510). Every wachat send path (single send, broadcast worker,
//! template send, flow runtime) calls this before writing a message log so
//! the log can FK back to a stable contact `_id` rather than a free-form
//! phone string.
//!
//! ## Behaviour
//!
//! Given `(project, phone_number_id, wa_id)` we issue **one** `update_one`
//! against the `contacts` collection with:
//!
//! * **Filter**: `{ projectId, phoneNumberId, waId }` — the same composite
//!   key the TS uses.
//! * **`$set`**: `{ phoneNumberId }` — keeps the phone number id current
//!   if a contact existed under another id (matches TS line 523).
//! * **`$setOnInsert`**: the new-row defaults (`waId`, `projectId`,
//!   `userId`, default `name`, `createdAt`, `status: "new"`, empty
//!   `tagIds`). Only applied on insert — concurrent callers converge on a
//!   single document.
//! * **`upsert: true`**: creates the document if no match exists.
//!
//! After the upsert we re-read the document to learn its `_id` and to know
//! whether we created it (driver returns `upserted_id` only on insert).
//!
//! ## What this slice does **not** do
//!
//! * `revalidatePath('/wachat/contacts')` — Next.js cache concerns are out
//!   of scope. Callers running inside an HTTP handler can call any
//!   equivalent invalidation themselves.
//! * Auth / project ownership checks — callers must pass an already-
//!   authorised `&Project` (matching the `projectFromAction` arg in the
//!   TS).
//! * Returning the full `Contact` document. Send paths only need the
//!   `_id`; readers wanting the full document should query `contacts`
//!   themselves with the returned id.
//!
//! ## Source-of-truth quote
//!
//! From `src/app/actions/whatsapp.actions.ts` lines 519-535:
//!
//! ```text
//! const { db } = await connectToDatabase();
//! const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
//!     { waId, projectId: new ObjectId(projectId), phoneNumberId },
//!     {
//!         $set: { phoneNumberId },
//!         $setOnInsert: {
//!             waId,
//!             projectId: new ObjectId(projectId),
//!             userId: project.userId,
//!             name: `User (${waId.slice(-4)})`,
//!             createdAt: new Date(),
//!             status: 'new',
//!             tagIds: [],
//!         }
//!     },
//!     { upsert: true, returnDocument: 'after' }
//! );
//! ```

#![forbid(unsafe_code)]

mod resolver;

pub use resolver::{ContactResolver, ResolvedContact};

/// Mongo collection name for contacts.
///
/// TS reference (`whatsapp.actions.ts` line 520):
/// ```text
/// db.collection<Contact>('contacts').findOneAndUpdate(...)
/// ```
pub const CONTACTS_COLL: &str = "contacts";
