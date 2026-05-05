//! `sabnode-api` binary entrypoint.
//!
//! Boots the tokio runtime, loads configuration, initializes tracing and DB
//! handles, builds the router, serves HTTP with graceful shutdown on
//! SIGINT/SIGTERM.

mod router;
mod routes;
mod state;

use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use common::Settings;
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use tokio::{net::TcpListener, signal};
use tracing::{error, info};
use wachat_chat_mark::ChatMarker;
use wachat_chat_read::ChatReader;
use wachat_contacts_resolve::ContactResolver;
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_payment_request::PaymentRequestSender;
use wachat_queue::BullProducer;
use wachat_send::MessageSender;
use wachat_send_cta::CtaSender;
use wachat_send_flows::FlowSender;
use wachat_send_orders::OrdersSender;
use wachat_send_router::WachatSendState;
use wachat_templates::TemplatesReader;
use wachat_templates_categories::TemplatesLibrary;
use wachat_templates_mutate::TemplatesMutator;
use wachat_templates_router::TemplatesState;
use wachat_templates_send::TemplateSender;
use wachat_templates_sync::TemplatesSyncer;
use wachat_webhook::WebhookState;
use wachat_webhook_account::AccountProcessor;
use wachat_webhook_contacts::ContactsUpserter;
use wachat_webhook_conversations::ConversationTracker;
use wachat_webhook_dlq::DlqWriter;
use wachat_webhook_inbound::InboundProcessor;
use wachat_webhook_status::StatusProcessor;
use wachat_webhook_template_events::TemplateEventsProcessor;
use wachat_webhook_verify::WebhookVerifier;

use crate::state::AppState;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    if let Err(e) = run().await {
        // Tracing may or may not be initialized at the failure point, so log
        // to stderr too for unattended boots.
        eprintln!("FATAL: {e:#}");
        error!(error = ?e, "fatal startup error");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let settings: Settings = common::load_settings().context("loading Settings")?;
    common::tracing_init::init(&settings.env);

    info!(env = %settings.env, port = settings.port, "starting sabnode-api");

    let mongo_uri = std::env::var("MONGODB_URI").context("MONGODB_URI is required")?;
    let mongo_db = std::env::var("MONGODB_DB").context("MONGODB_DB is required")?;
    let redis_url = std::env::var("REDIS_URL").context("REDIS_URL is required")?;
    let jwt_secret = std::env::var("RUST_JWT_SECRET").context("RUST_JWT_SECRET is required")?;

    let mongo = MongoHandle::connect(&mongo_uri, &mongo_db)
        .await
        .context("connecting to MongoDB")?;
    mongo.ping().await.context("MongoDB initial ping")?;
    info!(db = %mongo_db, "mongodb connected");

    let redis = RedisHandle::connect(&redis_url)
        .await
        .context("connecting to Redis")?;
    redis.ping().await.context("Redis initial ping")?;
    info!("redis connected");

    let auth = Arc::new(AuthConfig {
        secret: jwt_secret.into_bytes(),
    });

    // Wachat webhook stack: build each processor over the shared Mongo
    // handle, plus a BullMQ producer for the DLQ. Verifier reads
    // FACEBOOK_APP_SECRET (matches the existing Next.js env var).
    let app_secret = std::env::var("FACEBOOK_APP_SECRET")
        .context("FACEBOOK_APP_SECRET is required for webhook signature verification")?;
    let webhook_verifier = Arc::new(WebhookVerifier::new(app_secret.into_bytes()));

    let bull = BullProducer::new(redis.clone());
    let webhook = WebhookState {
        mongo: mongo.clone(),
        redis: redis.clone(),
        status: Arc::new(StatusProcessor::new(mongo.clone())),
        inbound: Arc::new(InboundProcessor::new(mongo.clone())),
        account: Arc::new(AccountProcessor::new(mongo.clone())),
        template_events: Arc::new(TemplateEventsProcessor::new(mongo.clone())),
        dlq: Arc::new(DlqWriter::new(mongo.clone(), bull)),
        contacts: Arc::new(ContactsUpserter::new(mongo.clone())),
        conversations: Arc::new(ConversationTracker::new(mongo.clone())),
    };

    // Templates stack: shared MetaClient (the Cloud API HTTP wrapper) +
    // MediaUploader (resumable uploads for template header images), plus
    // one engine per concern. Pin Meta to v23.0 (matches Node code today).
    let meta = MetaClient::new("v23.0");
    let media = MediaUploader::new("v23.0");
    let templates = TemplatesState {
        reader: Arc::new(TemplatesReader::new(mongo.clone())),
        mutator: Arc::new(TemplatesMutator::new(mongo.clone(), meta.clone(), media)),
        syncer: Arc::new(TemplatesSyncer::new(mongo.clone(), meta.clone())),
        library: Arc::new(TemplatesLibrary::new(mongo.clone())),
        sender: Arc::new(TemplateSender::new(mongo.clone(), meta.clone())),
        mongo: mongo.clone(),
    };

    // Send/chat/payment stack — Phase 4. Each engine takes the shared
    // Mongo handle (and MetaClient where it talks to Meta).
    let send = WachatSendState {
        message: Arc::new(MessageSender::new(
            mongo.clone(),
            meta.clone(),
            MediaUploader::new("v23.0"),
        )),
        cta: Arc::new(CtaSender::new(mongo.clone(), meta.clone())),
        flows: Arc::new(FlowSender::new(mongo.clone(), meta.clone())),
        orders: Arc::new(OrdersSender::new(mongo.clone(), meta.clone())),
        contacts: Arc::new(ContactResolver::new(mongo.clone())),
        chat_read: Arc::new(ChatReader::new(mongo.clone())),
        chat_mark: Arc::new(ChatMarker::new(mongo.clone())),
        payment: Arc::new(PaymentRequestSender::new(mongo.clone(), meta.clone())),
        mongo: mongo.clone(),
    };

    let state = AppState::new(
        mongo,
        redis,
        auth,
        webhook,
        webhook_verifier,
        templates,
        send,
    );
    let app = router::build(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], settings.port));
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    info!(%addr, "listening");

    state.mark_ready();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve")?;

    info!("shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            error!(error = %e, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => error!(error = %e, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received SIGINT, shutting down"),
        _ = terminate => info!("received SIGTERM, shutting down"),
    }
}
