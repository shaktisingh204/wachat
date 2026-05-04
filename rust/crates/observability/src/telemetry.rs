//! Tracing + OpenTelemetry initialisation.
//!
//! ## Layout
//!
//! [`init_telemetry`] always installs:
//!
//! 1. A global [`tracing_subscriber`] with an [`EnvFilter`] that defaults to
//!    `info` (overridable via `RUST_LOG`).
//! 2. A formatting layer — JSON in production (`SABNODE_ENV=production`/`prod`)
//!    or a human-friendly pretty layer in dev.
//!
//! When `otlp_endpoint` is `Some`, an additional OTLP HTTP exporter is wired in
//! as a `tracing-opentelemetry` layer so every `tracing` span is also exported
//! to the configured collector. The exporter is the same OTLP HTTP collector
//! used by the Node.js side (`@opentelemetry/exporter-trace-otlp-http`).
//!
//! ## Shutdown
//!
//! Whenever the OTLP layer is installed, the binary **must** call
//! [`opentelemetry::global::shutdown_tracer_provider`] from `main` on SIGTERM /
//! SIGINT to flush the batch span processor. Failing to do so will silently
//! drop in-flight spans that have not yet been exported. Example:
//!
//! ```no_run
//! # async fn run() -> anyhow::Result<()> {
//! sabnode_observability::init_telemetry(
//!     "sabnode-api",
//!     std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").ok().as_deref(),
//! )?;
//!
//! // ... serve traffic ...
//!
//! tokio::signal::ctrl_c().await?;
//! opentelemetry::global::shutdown_tracer_provider();
//! # Ok(())
//! # }
//! ```

use anyhow::{Context, Result};
use opentelemetry::{KeyValue, global, trace::TracerProvider as _};
use opentelemetry_otlp::{Protocol, WithExportConfig};
use opentelemetry_sdk::{Resource, runtime, trace::TracerProvider};
use opentelemetry_semantic_conventions::resource::SERVICE_NAME;
use tracing_subscriber::{EnvFilter, Layer, layer::SubscriberExt, util::SubscriberInitExt};

const DEFAULT_FILTER: &str = "info";

/// Initialise global tracing + (optional) OTLP export.
///
/// * `service_name` — sets the OTel `service.name` resource attribute and is
///   embedded into every span.
/// * `otlp_endpoint` — base URL of an OTLP/HTTP collector (e.g.
///   `http://localhost:4318`). When `None`, only local stdout logging is
///   configured.
///
/// This function is **not** idempotent — call it exactly once at process
/// start-up. Calling it twice will return an error from
/// `tracing_subscriber::registry().init()`.
pub fn init_telemetry(service_name: &str, otlp_endpoint: Option<&str>) -> Result<()> {
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));

    let is_prod = matches!(
        std::env::var("SABNODE_ENV").as_deref(),
        Ok("production") | Ok("prod")
    );

    let fmt_layer: Box<dyn Layer<_> + Send + Sync> = if is_prod {
        Box::new(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(false),
        )
    } else {
        Box::new(tracing_subscriber::fmt::layer().pretty())
    };

    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer);

    if let Some(endpoint) = otlp_endpoint {
        let otel_layer = build_otel_layer(service_name, endpoint)
            .context("failed to build OpenTelemetry tracing layer")?;
        registry
            .with(otel_layer)
            .try_init()
            .context("tracing subscriber already initialised")?;
    } else {
        registry
            .try_init()
            .context("tracing subscriber already initialised")?;
    }

    Ok(())
}

fn build_otel_layer<S>(
    service_name: &str,
    endpoint: &str,
) -> Result<tracing_opentelemetry::OpenTelemetryLayer<S, opentelemetry_sdk::trace::Tracer>>
where
    S: tracing::Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(endpoint)
        .with_protocol(Protocol::HttpBinary)
        .build()
        .context("failed to build OTLP HTTP span exporter")?;

    let resource = Resource::new(vec![KeyValue::new(SERVICE_NAME, service_name.to_owned())]);

    let provider = TracerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .with_resource(resource)
        .build();

    let tracer = provider.tracer(service_name.to_owned());
    global::set_tracer_provider(provider);

    Ok(tracing_opentelemetry::layer().with_tracer(tracer))
}
