use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use telegram_bots::bot_api::BotCommand;

use crate::state::TelegramCommandsState;

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

#[derive(Debug, Clone, Serialize)]
pub struct CommandsResp {
    pub commands: Vec<BotCommand>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetBody {
    pub commands: Vec<BotCommand>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
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
//  GET /v1/telegram/commands/{bot_id}
// =========================================================================

pub async fn get_commands(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(bot_id): Path<String>,
) -> Json<CommandsResp> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(CommandsResp {
                commands: vec![],
                error: Some(e),
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(CommandsResp {
                commands: vec![],
                error: Some("Bot is missing token.".to_owned()),
            });
        }
    };
    match s.bot_api.get_my_commands(&token).await {
        Ok(cmds) => Json(CommandsResp {
            commands: cmds,
            error: None,
        }),
        Err(_) => {
            // Fallback to whatever we cached on the bot doc.
            let cmds = bot
                .get_array("commands")
                .ok()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|b| {
                            let d = b.as_document()?;
                            Some(BotCommand {
                                command: d.get_str("command").ok()?.to_owned(),
                                description: d.get_str("description").ok()?.to_owned(),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            Json(CommandsResp {
                commands: cmds,
                error: None,
            })
        }
    }
}

// =========================================================================
//  POST /v1/telegram/commands/{bot_id}
// =========================================================================

pub async fn set_commands(
    user: AuthUser,
    State(s): State<TelegramCommandsState>,
    Path(bot_id): Path<String>,
    Json(body): Json<SetBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(AckResult {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Bot not found.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Bot is missing token.".to_owned()),
                ..Default::default()
            });
        }
    };

    if let Err(e) = s.bot_api.set_my_commands(&token, &body.commands).await {
        return Json(AckResult {
            success: false,
            error: Some(format!("{e}")),
            ..Default::default()
        });
    }

    let cmds_doc: Vec<Document> = body
        .commands
        .iter()
        .map(|c| doc! { "command": &c.command, "description": &c.description })
        .collect();
    let _ = s
        .mongo
        .collection::<Document>(BOTS)
        .update_one(
            doc! { "_id": bot_oid },
            doc! {
                "$set": {
                    "commands": cmds_doc,
                    "updatedAt": bson::DateTime::now(),
                }
            },
        )
        .await;

    Json(AckResult {
        success: true,
        message: Some("Commands saved.".to_owned()),
        ..Default::default()
    })
}
