//! Shared state for url-shortener handlers — Mongo + a process-wide
//! hickory DNS resolver for custom-domain TXT verification.

use std::sync::Arc;

use hickory_resolver::TokioAsyncResolver;
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct UrlShortenerState {
    pub mongo: MongoHandle,
    /// One resolver shared across requests so we don't pay system-config
    /// load on each TXT lookup.
    pub resolver: Arc<TokioAsyncResolver>,
}

impl UrlShortenerState {
    pub fn new(mongo: MongoHandle) -> Self {
        // `from_system_conf` reads /etc/resolv.conf on Linux/macOS and the
        // OS-configured nameservers on Windows. If it fails we fall back
        // to Cloudflare 1.1.1.1 + Google 8.8.8.8 so verify still works in
        // bare containers.
        let resolver = TokioAsyncResolver::tokio_from_system_conf().unwrap_or_else(|_| {
            use hickory_resolver::config::{ResolverConfig, ResolverOpts};
            TokioAsyncResolver::tokio(ResolverConfig::cloudflare(), ResolverOpts::default())
        });
        Self {
            mongo,
            resolver: Arc::new(resolver),
        }
    }
}
