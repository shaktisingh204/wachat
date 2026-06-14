//! Generate Routr (open-source SIP) resources from the SabCall resource model.
//!
//! Routr (https://routr.io — the Fonoster SIP stack) is the signaling layer:
//! a SIP proxy + location server + registrar that routes calls between trunks,
//! numbers and agents. It is NOT a media server — programmable media (IVR /
//! record / TTS / conference) is handled by the media tier; Routr decides where
//! a call goes, the media tier decides what happens on it.
//!
//! This module is the Routr analog of `pjsip.rs`: it reads the same SIP
//! collections the Next.js side manages and emits Routr v2-style resource
//! objects (Domain / Trunk / Agent / Credentials / ACL / Number) as JSON. Feed
//! the output to Routr via its SDK/CLI or the `files` connector. The mapping is
//! deliberately simple + documented so it can be tuned (see SETUP.md).

use futures_util::TryStreamExt;
use mongodb::bson::doc;
use mongodb::Database;
use serde::Deserialize;
use serde_json::{json, Value};

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
    register: bool,
    #[serde(rename = "inboundEnabled", default)]
    inbound_enabled: bool,
    #[serde(rename = "outboundEnabled", default)]
    outbound_enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct DomainDoc {
    domain: String,
    #[serde(default)]
    label: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct CredentialDoc {
    username: String,
    #[serde(default)]
    label: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct AclDoc {
    name: String,
    #[serde(default)]
    action: String,
    #[serde(default)]
    cidrs: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct DidDoc {
    number: String,
    #[serde(default)]
    country: String,
}

fn slug(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect()
}

async fn load<T: for<'de> Deserialize<'de> + Send + Sync + Unpin>(
    db: &Database,
    coll: &str,
    tenant: &str,
) -> anyhow::Result<Vec<T>> {
    Ok(db
        .collection::<T>(coll)
        .find(doc! { "userId": tenant, "status": "active" })
        .await?
        .try_collect()
        .await?)
}

/// Render the Routr resource set for one tenant (project id string).
pub async fn render_for_tenant(db: &Database, tenant: &str) -> anyhow::Result<Value> {
    let trunks: Vec<TrunkDoc> = load(db, "sabcall_trunks", tenant).await?;
    let domains: Vec<DomainDoc> = load(db, "sabcall_domains", tenant).await?;
    let creds: Vec<CredentialDoc> = load(db, "sabcall_credentials", tenant).await?;
    let acls: Vec<AclDoc> = load(db, "sabcall_acls", tenant).await?;
    let numbers: Vec<DidDoc> = load(db, "sabcall_dids", tenant).await?;

    // Routr v2 resources: { apiVersion, kind, ref, metadata, spec }.
    let domain_res: Vec<Value> = domains
        .iter()
        .map(|d| {
            json!({
                "apiVersion": "v2beta1",
                "kind": "Domain",
                "ref": format!("dm-{}", slug(&d.domain)),
                "metadata": { "name": d.label.clone().unwrap_or_else(|| d.domain.clone()) },
                "spec": { "context": { "domainUri": d.domain } }
            })
        })
        .collect();

    let trunk_res: Vec<Value> = trunks
        .iter()
        .filter(|t| !t.sip_server.trim().is_empty())
        .map(|t| {
            let transport = if t.transport.is_empty() { "udp" } else { &t.transport };
            json!({
                "apiVersion": "v2beta1",
                "kind": "Trunk",
                "ref": format!("tk-{}", slug(&t.name)),
                "metadata": { "name": t.name },
                "spec": {
                    "inbound": { "enabled": t.inbound_enabled },
                    "outbound": {
                        "enabled": t.outbound_enabled,
                        "register": t.register,
                        "uris": [{
                            "host": t.sip_server.trim(),
                            "port": t.port.unwrap_or(5060),
                            "transport": transport,
                        }],
                        // auth username only — the secret value lives in SabVault
                        // (see the secrets vault); inject it out-of-band.
                        "credentialsRef": t.auth_username.clone(),
                    }
                }
            })
        })
        .collect();

    let agent_res: Vec<Value> = creds
        .iter()
        .map(|c| {
            json!({
                "apiVersion": "v2beta1",
                "kind": "Agent",
                "ref": format!("ag-{}", slug(&c.username)),
                "metadata": { "name": c.label.clone().unwrap_or_else(|| c.username.clone()) },
                "spec": { "username": c.username, "credentialsRef": c.username, "enabled": true }
            })
        })
        .collect();

    let acl_res: Vec<Value> = acls
        .iter()
        .map(|a| {
            let rule = if a.action == "deny" { "deny" } else { "allow" };
            json!({
                "apiVersion": "v2beta1",
                "kind": "Acl",
                "ref": format!("acl-{}", slug(&a.name)),
                "metadata": { "name": a.name },
                "spec": { rule: a.cidrs }
            })
        })
        .collect();

    let number_res: Vec<Value> = numbers
        .iter()
        .map(|n| {
            json!({
                "apiVersion": "v2beta1",
                "kind": "Number",
                "ref": format!("nb-{}", slug(&n.number)),
                "metadata": { "name": n.number },
                "spec": {
                    "location": { "telUrl": format!("tel:{}", n.number) },
                    "country": n.country,
                }
            })
        })
        .collect();

    Ok(json!({
        "tenant": tenant,
        "domains": domain_res,
        "trunks": trunk_res,
        "agents": agent_res,
        "acls": acl_res,
        "numbers": number_res,
    }))
}
