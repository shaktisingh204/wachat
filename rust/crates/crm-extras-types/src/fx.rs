//! §12.17 Multi-currency & FX.
//!
//! Three top-level DTOs:
//!
//! - [`FxSettings`] — per-tenant base currency, supported list, provider
//!   credentials reference. Stored in `crm_fx_settings` (one document
//!   per tenant — singleton-shaped via the flattened `Identity`).
//! - [`FxRate`] — a single (from → to) rate at an as-of timestamp.
//!   Stored in `crm_fx_rates`. Combination of (from, to, asOf) plus a
//!   manual-override flag and the source label.
//! - [`FxRevaluation`] — output of a period-end revaluation run. Stored
//!   in `crm_fx_revaluations`. Captures opening / closing rates, the
//!   realised vs unrealised gain/loss split, and whether the resulting
//!   GL journal entries have been posted.
//!
//! All three flatten the `crm-core` cross-cutting fragments (`Identity`,
//! `Audit`) so the document root carries the §0 ownership / audit
//! fields directly.
//!
//! Spec verbatim: Base currency, supported currencies[], FX provider,
//! rate as-of, manual override, realised gain/loss, unrealised,
//! revaluation run.

use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};

#[cfg(test)]
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/* ============================================================
 * FxSettings
 * ============================================================ */

/// Per-tenant FX configuration. Singleton-shaped — there is at most one
/// `FxSettings` document per `(projectId, userId)` tuple. The provider
/// credentials are not embedded; instead, `provider_credentials_ref`
/// points at the secret-store entry holding the API key so the DTO can
/// be safely projected back to the client without leaking secrets.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FxSettings {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// ISO 4217 base currency (e.g. `"INR"`, `"USD"`). All ledgers
    /// roll up into this currency for reporting.
    pub base_currency: String,

    /// ISO 4217 codes the tenant transacts in. The base currency is
    /// implicitly supported and need not be repeated here.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub supported_currencies: Vec<String>,

    /// Provider key. `"manual"` disables the auto-fetch loop and forces
    /// every rate to be a manual override; the others are external
    /// integrations whose credentials live behind `provider_credentials_ref`.
    /// Free-form string so new providers can be onboarded without a
    /// schema migration.
    pub provider: String,

    /// Pointer to the secret-store entry (vault key, env var name, …)
    /// holding the provider's API credential. Never the credential itself.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_credentials_ref: Option<String>,
}

/* ============================================================
 * FxRate
 * ============================================================ */

/// A single FX rate observation. The (from, to, asOf) triple is the
/// natural key — the worker that fetches rates upserts on this triple
/// so re-runs on the same day are idempotent.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FxRate {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Source ISO 4217 code (e.g. `"USD"`).
    pub from: String,
    /// Target ISO 4217 code (e.g. `"INR"`).
    pub to: String,

    /// Multiplier such that `amount_from * rate = amount_to`.
    pub rate: f64,

    /// As-of timestamp the rate is published for. The worker uses this
    /// to pick the latest rate at posting time (`asOf <= postingDate`).
    pub as_of: DateTime<Utc>,

    /// `true` when a finance user pinned the rate manually — the
    /// auto-fetch loop must not overwrite it on the next refresh.
    #[serde(default)]
    pub manual_override: bool,

    /// Provider / origin label (e.g. `"openexchangerates"`, `"rbi"`,
    /// `"manual"`). Free-form so new sources can be added without a
    /// schema bump.
    pub source: String,
}

/* ============================================================
 * FxRevaluation
 * ============================================================ */

/// One row of a period-end revaluation run. For each foreign currency
/// the tenant holds balances in, the worker computes the gain/loss
/// caused by rate movement between the opening and closing rates.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FxRevaluation {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// When the revaluation was run (worker invocation timestamp).
    pub run_at: DateTime<Utc>,

    /// ISO 4217 base currency the revaluation is being expressed in.
    pub base_currency: String,
    /// ISO 4217 foreign currency this row revalues.
    pub foreign_currency: String,

    /// Foreign-currency balance at the start of the period.
    pub opening_balance_foreign: f64,
    /// Rate (foreign → base) at period start.
    pub opening_rate: f64,
    /// Rate (foreign → base) at period close.
    pub closing_rate: f64,

    /// Gain/loss already realised through settled transactions during
    /// the period (in base currency).
    pub realised_gain_loss: f64,
    /// Mark-to-market gain/loss on the unsettled foreign balance at
    /// period close (in base currency).
    pub unrealised_gain_loss: f64,

    /// Whether the resulting journal entries have been pushed to the GL.
    #[serde(default)]
    pub gl_entries_posted: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn fx_settings_round_trips_with_flattened_fragments() {
        let s = FxSettings {
            identity: ident(),
            audit: Audit::new(None),
            base_currency: "INR".into(),
            supported_currencies: vec!["USD".into(), "EUR".into()],
            provider: "openexchangerates".into(),
            provider_credentials_ref: Some("vault://fx/oxr".into()),
        };

        let json = serde_json::to_value(&s).unwrap();

        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());

        assert!(json.get("baseCurrency").is_some());
        assert!(json.get("supportedCurrencies").is_some());
        assert!(json.get("providerCredentialsRef").is_some());

        let back: FxSettings = serde_json::from_value(json).unwrap();
        assert_eq!(back.base_currency, "INR");
        assert_eq!(back.supported_currencies.len(), 2);
        assert_eq!(back.provider, "openexchangerates");
    }

    #[test]
    fn fx_rate_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let r = FxRate {
            identity: ident(),
            audit: Audit::new(None),
            from: "USD".into(),
            to: "INR".into(),
            rate: 83.42,
            as_of: now,
            manual_override: true,
            source: "manual".into(),
        };

        let json = serde_json::to_value(&r).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("manualOverride").is_some());
        assert!(json.get("asOf").is_some());

        let back: FxRate = serde_json::from_value(json).unwrap();
        assert_eq!(back.from, "USD");
        assert_eq!(back.to, "INR");
        assert!(back.manual_override);
        assert!((back.rate - 83.42).abs() < 1e-9);
    }

    #[test]
    fn fx_revaluation_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let v = FxRevaluation {
            identity: ident(),
            audit: Audit::new(None),
            run_at: now,
            base_currency: "INR".into(),
            foreign_currency: "USD".into(),
            opening_balance_foreign: 10_000.0,
            opening_rate: 82.10,
            closing_rate: 83.42,
            realised_gain_loss: 4_500.0,
            unrealised_gain_loss: 13_200.0,
            gl_entries_posted: false,
        };

        let json = serde_json::to_value(&v).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("runAt").is_some());
        assert!(json.get("openingBalanceForeign").is_some());
        assert!(json.get("openingRate").is_some());
        assert!(json.get("closingRate").is_some());
        assert!(json.get("realisedGainLoss").is_some());
        assert!(json.get("unrealisedGainLoss").is_some());
        assert!(json.get("glEntriesPosted").is_some());

        let back: FxRevaluation = serde_json::from_value(json).unwrap();
        assert_eq!(back.base_currency, "INR");
        assert_eq!(back.foreign_currency, "USD");
        assert!(!back.gl_entries_posted);
        assert!((back.opening_rate - 82.10).abs() < 1e-9);
    }
}
