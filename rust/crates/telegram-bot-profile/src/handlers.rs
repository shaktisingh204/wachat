use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramBotProfileState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProfileBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "shortDescription")]
    pub short_description: Option<String>,
    #[serde(default, rename = "miniAppUrl")]
    pub mini_app_url: Option<String>,
    #[serde(default, rename = "paymentProviderToken")]
    pub payment_provider_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum MenuButton {
    #[serde(rename = "default")]
    Default,
    #[serde(rename = "commands")]
    Commands,
    #[serde(rename = "web_app")]
    WebApp { text: String, url: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetMenuButtonBody {
    #[serde(rename = "menuButton")]
    pub menu_button: MenuButton,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        message: None,
    })
}

async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

// =========================================================================
//  POST /v1/telegram/bot-profile/{bot_id}
// =========================================================================

pub async fn update_profile(
    user: AuthUser,
    State(s): State<TelegramBotProfileState>,
    Path(bot_id): Path<String>,
    Json(body): Json<UpdateProfileBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing token."),
    };
    let current_name = bot.get_str("name").unwrap_or("");

    if let Some(name) = body.name.as_deref() {
        if name != current_name {
            let truncated: String = name.chars().take(64).collect();
            if let Err(e) = s.bot_api.set_my_name(&token, &truncated).await {
                return err(format!("{e}"));
            }
        }
    }
    if let Some(desc) = body.description.as_deref() {
        let truncated: String = desc.chars().take(512).collect();
        if let Err(e) = s.bot_api.set_my_description(&token, &truncated).await {
            return err(format!("{e}"));
        }
    }
    if let Some(short) = body.short_description.as_deref() {
        let truncated: String = short.chars().take(120).collect();
        if let Err(e) = s.bot_api.set_my_short_description(&token, &truncated).await {
            return err(format!("{e}"));
        }
    }

    let mut set = doc! { "updatedAt": bson::DateTime::now() };
    if let Some(v) = body.name {
        set.insert("name", v);
    }
    if let Some(v) = body.description {
        set.insert("description", v);
    }
    if let Some(v) = body.short_description {
        set.insert("shortDescription", v);
    }
    if let Some(v) = body.mini_app_url {
        set.insert("miniAppUrl", v);
    }
    if let Some(v) = body.payment_provider_token {
        set.insert("paymentProviderToken", v);
    }
    let _ = s
        .mongo
        .collection::<Document>(BOTS)
        .update_one(doc! { "_id": bot_oid }, doc! { "$set": set })
        .await;

    Json(AckResult {
        success: true,
        message: Some("Profile updated.".to_owned()),
        error: None,
    })
}

// =========================================================================
//  POST /v1/telegram/bot-profile/{bot_id}/menu-button
// =========================================================================

pub async fn set_menu_button(
    user: AuthUser,
    State(s): State<TelegramBotProfileState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetMenuButtonBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing token."),
    };

    let (telegram_payload, persisted) = match &body.menu_button {
        MenuButton::Default => (
            serde_json::json!({ "type": "default" }),
            doc! { "type": "default" },
        ),
        MenuButton::Commands => (
            serde_json::json!({ "type": "commands" }),
            doc! { "type": "commands" },
        ),
        MenuButton::WebApp { text, url } => (
            serde_json::json!({
                "type": "web_app",
                "text": text,
                "web_app": { "url": url },
            }),
            doc! { "type": "web_app", "text": text, "url": url },
        ),
    };

    if let Err(e) = s
        .bot_api
        .set_chat_menu_button(&token, &telegram_payload)
        .await
    {
        return err(format!("{e}"));
    }

    let _ = s
        .mongo
        .collection::<Document>(BOTS)
        .update_one(
            doc! { "_id": bot_oid },
            doc! { "$set": { "menuButton": persisted, "updatedAt": bson::DateTime::now() } },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Menu button updated.".to_owned()),
        error: None,
    })
}
