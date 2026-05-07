//! Top-level dispatch — routes each `EntityKey` to the appropriate
//! executor: Mongo collection, embedded sub-doc, or static data.

use crate::context::TenantCtx;
use crate::embedded_lookup;
use crate::entities;
use crate::mongo_lookup;
use crate::static_lookup;
use crm_lookup_types::{EntityKey, LookupParams, LookupResult};
use sabnode_common::Result;
use sabnode_db::MongoHandle;

/// Resolve the lookup for `entity` against the configured Mongo
/// handle.
///
/// **All 42 `EntityKey` variants are wired:**
/// - **Mongo collection (37 entities)** — Client, Vendor, Item,
///   Employee, User, Account, Warehouse, BankAccount, Lead, Contact,
///   Deal, Invoice, Quotation, SalesOrder, PurchaseOrder, Bill,
///   Receipt, Asset, Ticket, Subscription, Plan, Coupon, Template,
///   Department, Designation, Shift, Holiday, Project, Branch,
///   CostCenter, Category, Tag, Source, Status, TaxRate, Hsn,
///   Pincode (cross-tenant `crm_pincodes`).
/// - **Embedded sub-doc** — Pipeline, Stage (`users.crmPipelines[]`).
/// - **Static reference** — Currency, Country, State.
pub async fn search(
    mongo: &MongoHandle,
    entity: EntityKey,
    params: &LookupParams,
    ctx: &TenantCtx,
) -> Result<LookupResult> {
    // Embedded sub-doc executor — pipeline + stage live on
    // `users.crmPipelines[]`.
    match entity {
        EntityKey::Pipeline => return embedded_lookup::pipeline_search(mongo, params, ctx).await,
        EntityKey::Stage => return embedded_lookup::stage_search(mongo, params, ctx).await,
        _ => {}
    }

    // Static-data executor — no Mongo round-trip.
    match entity {
        EntityKey::Currency => return static_lookup::currency_search(params),
        EntityKey::Country => return static_lookup::country_search(params),
        EntityKey::State => return static_lookup::state_search(params),
        EntityKey::Unit => return static_lookup::units_search(params),
        EntityKey::Industry => return static_lookup::industries_search(params),
        EntityKey::VendorType => return static_lookup::vendor_types_search(params),
        EntityKey::Location => return static_lookup::location_search(params),
        _ => {}
    }

    // Mongo collection executor.
    let spec = match entity {
        // Canonical 8.
        EntityKey::Client => &entities::client::SPEC,
        EntityKey::Vendor => &entities::vendor::SPEC,
        EntityKey::Item => &entities::item::SPEC,
        EntityKey::Employee => &entities::employee::SPEC,
        EntityKey::User => &entities::user::SPEC,
        EntityKey::Account => &entities::account::SPEC,
        EntityKey::Warehouse => &entities::warehouse::SPEC,
        EntityKey::BankAccount => &entities::bank_account::SPEC,

        // Sales-CRM.
        EntityKey::Lead => &entities::lead::SPEC,
        EntityKey::Contact => &entities::contact::SPEC,
        EntityKey::Deal => &entities::deal::SPEC,

        // Sales docs.
        EntityKey::Invoice => &entities::invoice::SPEC,
        EntityKey::Quotation => &entities::quotation::SPEC,
        EntityKey::SalesOrder => &entities::sales_order::SPEC,

        // Purchase docs.
        EntityKey::PurchaseOrder => &entities::purchase_order::SPEC,
        EntityKey::Bill => &entities::bill::SPEC,
        EntityKey::Receipt => &entities::receipt::SPEC,

        // §12 advanced features.
        EntityKey::Asset => &entities::asset::SPEC,
        EntityKey::Ticket => &entities::ticket::SPEC,
        EntityKey::Subscription => &entities::subscription::SPEC,
        EntityKey::Plan => &entities::plan::SPEC,
        EntityKey::Coupon => &entities::coupon::SPEC,
        EntityKey::Template => &entities::template::SPEC,

        // HR refs.
        EntityKey::Department => &entities::department::SPEC,
        EntityKey::Designation => &entities::designation::SPEC,
        EntityKey::Shift => &entities::shift::SPEC,
        EntityKey::Holiday => &entities::holiday::SPEC,

        // Multi-branch / project / cost-center.
        EntityKey::Project => &entities::project::SPEC,
        EntityKey::Branch => &entities::branch::SPEC,
        EntityKey::CostCenter => &entities::cost_center::SPEC,
        EntityKey::Category => &entities::category::SPEC,

        // Tenant-grown product brands.
        EntityKey::Brand => &entities::brand::SPEC,

        // Small reference catalogues.
        EntityKey::Tag => &entities::tag::SPEC,
        EntityKey::Source => &entities::source::SPEC,
        EntityKey::Status => &entities::status::SPEC,
        EntityKey::TaxRate => &entities::tax_rate::SPEC,
        EntityKey::Hsn => &entities::hsn::SPEC,

        // India PIN reference data — cross-tenant. The collection
        // `crm_pincodes` must be seeded once at deploy-time from the
        // India Post CSV; the spec sets `is_global: true` so the
        // executor skips the per-tenant `userId` narrowing.
        EntityKey::Pincode => &entities::pincode::SPEC,

        // Variants already handled by the embedded / static branches
        // above — unreachable, but the compiler needs an exhaustive
        // match.
        EntityKey::Pipeline
        | EntityKey::Stage
        | EntityKey::Currency
        | EntityKey::Country
        | EntityKey::State
        | EntityKey::Unit
        | EntityKey::Industry
        | EntityKey::VendorType
        | EntityKey::Location => unreachable!("handled by embedded/static branch above"),
    };

    mongo_lookup::execute(mongo, spec, params, ctx).await
}
