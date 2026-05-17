//! Axum handlers for `/v1/oauth/*`.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;

use crate::{
    dto::{
        Ack, AppList, AuthorizeBody, AuthorizeResult, IntrospectBody, IntrospectResponse,
        OauthApp, RegisterAppBody, RegisterAppResult, RevokeBody, TokenGrant, TokenResponse,
    },
    store,
};

/* ── App registration (developer-authenticated) ────────────────────────── */

pub async fn register_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<RegisterAppBody>,
) -> Result<Json<RegisterAppResult>> {
    let r = store::register_app(
        &mongo,
        &user.user_id,
        &body.name,
        body.redirect_uris,
        body.scopes,
        body.description,
    )
    .await?;
    Ok(Json(RegisterAppResult {
        app: r.app,
        client_secret: r.plain_client_secret,
    }))
}

pub async fn list_apps(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<AppList>> {
    let data: Vec<OauthApp> = store::list_apps(&mongo, &user.user_id).await?;
    Ok(Json(AppList { data }))
}

pub async fn delete_app(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(app_id): Path<String>,
) -> Result<Json<Ack>> {
    let ok = store::delete_app(&mongo, &user.user_id, &app_id).await?;
    Ok(Json(Ack {
        success: ok,
        error: if ok { None } else { Some("app not found".to_owned()) },
    }))
}

/* ── /authorize (called by the Next.js consent page on tenant approval) ── */

pub async fn authorize(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AuthorizeBody>,
) -> Result<Json<AuthorizeResult>> {
    if body.response_type != "code" {
        return Err(sabnode_common::ApiError::BadRequest(
            "response_type must be 'code'".to_owned(),
        ));
    }
    let code = store::create_authorization_code(
        &mongo,
        &user.user_id, // tenant_id
        &user.user_id, // user_id (granting user)
        &body.client_id,
        &body.redirect_uri,
        &body.scope,
        &body.code_challenge,
        &body.code_challenge_method,
    )
    .await?;
    Ok(Json(AuthorizeResult {
        code,
        state: body.state,
        redirect_uri: body.redirect_uri,
    }))
}

/* ── /token (public; PKCE-protected) ──────────────────────────────────── */

pub async fn token(
    State(mongo): State<MongoHandle>,
    Json(grant): Json<TokenGrant>,
) -> Result<Json<TokenResponse>> {
    let issued = match grant {
        TokenGrant::AuthorizationCode {
            code,
            client_id,
            client_secret,
            redirect_uri,
            code_verifier,
        } => {
            store::exchange_code(
                &mongo,
                &code,
                &client_id,
                client_secret.as_deref(),
                &redirect_uri,
                &code_verifier,
            )
            .await?
        }
        TokenGrant::RefreshToken {
            refresh_token,
            client_id,
            client_secret,
        } => {
            store::refresh_tokens(&mongo, &refresh_token, &client_id, client_secret.as_deref())
                .await?
        }
    };
    Ok(Json(TokenResponse {
        access_token: issued.access_plain,
        token_type: "Bearer",
        expires_in: issued.expires_in,
        refresh_token: issued.refresh_plain,
        scope: issued.scope,
    }))
}

/* ── /revoke + /introspect (public) ────────────────────────────────────── */

pub async fn revoke(
    State(mongo): State<MongoHandle>,
    Json(body): Json<RevokeBody>,
) -> Result<Json<Ack>> {
    let ok = store::revoke_token(&mongo, &body.token).await?;
    Ok(Json(Ack {
        success: ok,
        error: None,
    }))
}

pub async fn introspect(
    State(mongo): State<MongoHandle>,
    Json(body): Json<IntrospectBody>,
) -> Result<Json<IntrospectResponse>> {
    let info = store::introspect(&mongo, &body.token).await?;
    Ok(Json(IntrospectResponse {
        active: info.active,
        scope: if info.scope.is_empty() { None } else { Some(info.scope) },
        client_id: info.client_id,
        tenant_id: info.tenant_id,
        user_id: info.user_id,
        exp: info.exp.map(|t| t.timestamp()),
    }))
}
