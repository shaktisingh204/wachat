//! Generate `pjsip.conf` fragments from the SabCall resource model.
//!
//! For a given tenant we render one endpoint/auth/aor block per active SIP
//! trunk and per active SIP credential. The output is meant to be dropped into
//! Asterisk's `pjsip.conf` (or pulled via `res_pjsip` realtime later). This is
//! deterministic text generation — no Asterisk connection required.

use std::fmt::Write as _;

use futures_util::TryStreamExt;
use mongodb::bson::doc;
use mongodb::Database;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
struct TrunkDoc {
    name: String,
    #[serde(rename = "sipServer", default)]
    sip_server: String,
    #[serde(default)]
    port: Option<i32>,
    #[serde(default)]
    transport: String,
    #[serde(rename = "authUsername", default)]
    auth_username: Option<String>,
    #[serde(default)]
    codecs: Vec<String>,
    #[serde(default)]
    register: bool,
    #[serde(default)]
    status: String,
}

#[derive(Debug, Clone, Deserialize)]
struct CredentialDoc {
    username: String,
    #[serde(default)]
    codecs: Vec<String>,
    #[serde(default)]
    status: String,
}

fn slug(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '_' })
        .collect()
}

fn codec_line(codecs: &[String]) -> String {
    if codecs.is_empty() {
        "allow=opus,ulaw,alaw".to_owned()
    } else {
        format!("allow={}", codecs.join(","))
    }
}

/// Render the pjsip.conf text for one tenant's trunks + credentials.
/// `tenant` is the project id string (the `userId` scope).
pub async fn render_for_tenant(db: &Database, tenant: &str) -> anyhow::Result<String> {
    let mut out = String::new();
    writeln!(out, "; ── SabCall generated pjsip.conf for tenant {tenant} ──").ok();

    let trunks: Vec<TrunkDoc> = db
        .collection::<TrunkDoc>("sabcall_trunks")
        .find(doc! { "userId": tenant, "status": "active" })
        .await?
        .try_collect()
        .await?;

    for t in &trunks {
        if t.sip_server.trim().is_empty() {
            continue;
        }
        let id = slug(&t.name);
        let transport = if t.transport.is_empty() { "udp" } else { &t.transport };
        let port = t.port.unwrap_or(5060);
        writeln!(out, "\n[trunk_{id}]\ntype=endpoint\ncontext=sabcall-inbound\ndisallow=all\n{codecs}\noutbound_auth=trunk_{id}_auth\naors=trunk_{id}_aor\ntransport=transport-{transport}",
            codecs = codec_line(&t.codecs)).ok();
        if let Some(u) = t.auth_username.as_deref().filter(|s| !s.is_empty()) {
            writeln!(out, "\n[trunk_{id}_auth]\ntype=auth\nauth_type=userpass\nusername={u}\n; password provisioned out-of-band from the trunk's secret ref").ok();
        }
        writeln!(out, "\n[trunk_{id}_aor]\ntype=aor\ncontact=sip:{server}:{port}",
            server = t.sip_server.trim()).ok();
        if t.register {
            writeln!(out, "\n[trunk_{id}_reg]\ntype=registration\noutbound_auth=trunk_{id}_auth\nserver_uri=sip:{server}:{port}\nclient_uri=sip:{user}@{server}",
                server = t.sip_server.trim(),
                user = t.auth_username.as_deref().unwrap_or("sabcall")).ok();
        }
    }

    let creds: Vec<CredentialDoc> = db
        .collection::<CredentialDoc>("sabcall_credentials")
        .find(doc! { "userId": tenant, "status": "active" })
        .await?
        .try_collect()
        .await?;

    for c in &creds {
        let id = slug(&c.username);
        writeln!(out, "\n[{u}]\ntype=endpoint\ncontext=sabcall-internal\ndisallow=all\n{codecs}\nauth={u}_auth\naors={u}_aor",
            u = id, codecs = codec_line(&c.codecs)).ok();
        writeln!(out, "\n[{id}_auth]\ntype=auth\nauth_type=userpass\nusername={user}\n; password provisioned out-of-band from the credential's secret ref",
            user = c.username).ok();
        writeln!(out, "\n[{id}_aor]\ntype=aor\nmax_contacts=3").ok();
    }

    Ok(out)
}
