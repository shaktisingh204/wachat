//! Generate Routr (open-source SIP) resources from the SabCall resource model.
//!
//! Routr (https://routr.io — the Fonoster SIP stack) is the signaling layer: a
//! SIP proxy + location server + registrar that routes calls between trunks,
//! numbers and agents. It is NOT a media server — programmable media (IVR /
//! record / TTS / conference) is handled by the media tier; Routr decides where
//! a call goes, the media tier decides what happens on it.
//!
//! This is the Routr analog of `pjsip.rs`. It emits **Routr v2beta1** resources
//! matching the schema in `services/routr/config/resources/*.yaml`
//! (Domain / AccessControlList / Credentials / Agent / Trunk / Number) as JSON.
//! Apply via the Routr SDK/CLI, or convert to YAML for the `files` connector.
//! Secret *values* are never emitted — credential passwords are placeholders to
//! replace from SabVault. The mapping is intentionally simple + tunable.

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

const PASSWORD_PLACEHOLDER: &str = "REPLACE_FROM_SABVAULT";

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

/// Render the Routr v2beta1 resource set for one tenant (project id string).
pub async fn render_for_tenant(db: &Database, tenant: &str) -> anyhow::Result<Value> {
    let trunks: Vec<TrunkDoc> = load(db, "sabcall_trunks", tenant).await?;
    let domains: Vec<DomainDoc> = load(db, "sabcall_domains", tenant).await?;
    let creds: Vec<CredentialDoc> = load(db, "sabcall_credentials", tenant).await?;
    let acls: Vec<AclDoc> = load(db, "sabcall_acls", tenant).await?;
    let numbers: Vec<DidDoc> = load(db, "sabcall_dids", tenant).await?;

    let first_acl_ref = acls.first().map(|a| format!("acl-{}", slug(&a.name)));
    let first_domain_ref = domains.first().map(|d| format!("dm-{}", slug(&d.domain)));
    let first_domain_uri = domains
        .first()
        .map(|d| d.domain.clone())
        .unwrap_or_else(|| "sip.local".to_owned());
    // Inbound calls land on the media-tier peer AOR (Asterisk → Stasis(sabcall)).
    let media_aor = format!("sip:sabcall@{first_domain_uri}");

    let acl_res: Vec<Value> = acls
        .iter()
        .map(|a| {
            let (allow, deny): (Vec<String>, Vec<String>) = if a.action == "deny" {
                (vec![], a.cidrs.clone())
            } else {
                (a.cidrs.clone(), vec![])
            };
            json!({
                "apiVersion": "v2beta1",
                "kind": "AccessControlList",
                "ref": format!("acl-{}", slug(&a.name)),
                "metadata": { "name": a.name },
                "spec": { "accessControlList": { "allow": allow, "deny": deny } }
            })
        })
        .collect();

    let domain_res: Vec<Value> = domains
        .iter()
        .map(|d| {
            let mut spec = json!({ "context": { "domainUri": d.domain } });
            if let Some(acl) = &first_acl_ref {
                spec["accessControlListRef"] = json!(acl);
            }
            json!({
                "apiVersion": "v2beta1",
                "kind": "Domain",
                "ref": format!("dm-{}", slug(&d.domain)),
                "metadata": { "name": d.label.clone().unwrap_or_else(|| d.domain.clone()) },
                "spec": spec
            })
        })
        .collect();

    // Credentials: one per SIP credential + one per trunk auth user. Passwords
    // are placeholders — inject the real values from SabVault.
    let mut credential_res: Vec<Value> = Vec::new();
    for c in &creds {
        credential_res.push(json!({
            "apiVersion": "v2beta1",
            "kind": "Credentials",
            "ref": format!("cr-{}", slug(&c.username)),
            "metadata": { "name": c.label.clone().unwrap_or_else(|| c.username.clone()) },
            "spec": { "credentials": { "username": c.username, "password": PASSWORD_PLACEHOLDER } }
        }));
    }
    for t in &trunks {
        if let Some(u) = t.auth_username.as_deref().filter(|s| !s.is_empty()) {
            credential_res.push(json!({
                "apiVersion": "v2beta1",
                "kind": "Credentials",
                "ref": format!("cr-trunk-{}", slug(&t.name)),
                "metadata": { "name": format!("{} trunk", t.name) },
                "spec": { "credentials": { "username": u, "password": PASSWORD_PLACEHOLDER } }
            }));
        }
    }

    let agent_res: Vec<Value> = creds
        .iter()
        .map(|c| {
            let mut spec = json!({
                "username": c.username,
                "credentialsRef": format!("cr-{}", slug(&c.username)),
                "privacy": "Private",
            });
            if let Some(dm) = &first_domain_ref {
                spec["domainRef"] = json!(dm);
            }
            json!({
                "apiVersion": "v2beta1",
                "kind": "Agent",
                "ref": format!("ag-{}", slug(&c.username)),
                "metadata": { "name": c.label.clone().unwrap_or_else(|| c.username.clone()) },
                "spec": spec
            })
        })
        .collect();

    let trunk_res: Vec<Value> = trunks
        .iter()
        .filter(|t| !t.sip_server.trim().is_empty())
        .map(|t| {
            let transport = if t.transport.is_empty() { "udp" } else { &t.transport };
            let cred_ref = format!("cr-trunk-{}", slug(&t.name));
            let mut inbound = json!({ "uri": t.sip_server.trim() });
            if let Some(acl) = &first_acl_ref {
                inbound["accessControlListRef"] = json!(acl);
            }
            json!({
                "apiVersion": "v2beta1",
                "kind": "Trunk",
                "ref": format!("tk-{}", slug(&t.name)),
                "metadata": { "name": t.name },
                "spec": {
                    "inbound": inbound,
                    "outbound": {
                        "sendRegister": t.register,
                        "credentialsRef": cred_ref,
                        "uris": [{
                            "uri": {
                                "user": t.auth_username.clone().unwrap_or_default(),
                                "host": t.sip_server.trim(),
                                "port": t.port.unwrap_or(5060),
                                "transport": transport,
                            },
                            "priority": 10,
                            "weight": 10,
                            "enabled": true,
                        }],
                    }
                }
            })
        })
        .collect();

    let first_trunk_ref = trunks.first().map(|t| format!("tk-{}", slug(&t.name)));
    let number_res: Vec<Value> = numbers
        .iter()
        .map(|n| {
            let mut spec = json!({
                "location": { "telUrl": format!("tel:{}", n.number), "aorLink": media_aor }
            });
            if let Some(tk) = &first_trunk_ref {
                spec["trunkRef"] = json!(tk);
            }
            json!({
                "apiVersion": "v2beta1",
                "kind": "Number",
                "ref": format!("nb-{}", slug(&n.number)),
                "metadata": {
                    "name": n.number,
                    "geoInfo": { "country": n.country, "countryIsoCode": n.country }
                },
                "spec": spec
            })
        })
        .collect();

    Ok(json!({
        "tenant": tenant,
        "accessControlLists": acl_res,
        "domains": domain_res,
        "credentials": credential_res,
        "agents": agent_res,
        "trunks": trunk_res,
        "numbers": number_res,
    }))
}
