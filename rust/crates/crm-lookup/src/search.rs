//! Top-level dispatch — picks the per-entity [`LookupSpec`] and hands
//! off to [`crate::mongo_lookup::execute`].

use crate::context::TenantCtx;
use crate::entities;
use crate::mongo_lookup;
use crm_lookup_types::{EntityKey, LookupParams, LookupResult};
use sabnode_common::{ApiError, Result};
use sabnode_db::MongoHandle;

/// Resolve the lookup for `entity` against the configured Mongo
/// handle. Entities not yet implemented return
/// [`ApiError::BadRequest`] — the canonical 8 are wired today.
pub async fn search(
    mongo: &MongoHandle,
    entity: EntityKey,
    params: &LookupParams,
    ctx: &TenantCtx,
) -> Result<LookupResult> {
    let spec = match entity {
        EntityKey::Client => &entities::client::SPEC,
        EntityKey::Vendor => &entities::vendor::SPEC,
        EntityKey::Item => &entities::item::SPEC,
        EntityKey::Employee => &entities::employee::SPEC,
        EntityKey::User => &entities::user::SPEC,
        EntityKey::Account => &entities::account::SPEC,
        EntityKey::Warehouse => &entities::warehouse::SPEC,
        EntityKey::BankAccount => &entities::bank_account::SPEC,
        other => {
            return Err(ApiError::BadRequest(format!(
                "lookup entity `{}` not yet implemented in the Rust executor; \
                 the TS server action remains the source of truth for this kind",
                other.as_str()
            )));
        }
    };

    mongo_lookup::execute(mongo, spec, params, ctx).await
}
