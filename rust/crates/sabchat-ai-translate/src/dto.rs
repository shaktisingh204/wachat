//! Wire-format DTOs for the SabChat AI translate endpoints.
//!
//! Every body / response uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js shim sends.
//!
//! The [`TranslateResp`](crate::translator::TranslateResp) and
//! [`DetectResp`](crate::translator::DetectResp) response shapes live
//! alongside the [`Translator`](crate::translator::Translator) trait
//! (those are the same structs we hand back over the wire) — this file
//! only declares the request bodies plus the bespoke message-translate
//! response envelope.

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /text`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/ai/translate/text`.
///
/// The TS shim forwards the rendered visitor- / agent-side text, the
/// BCP-47 target language, and optionally a `source` override when the
/// surface already knows the source (e.g. a per-contact preferred
/// language). When `source` is omitted the backend detects it and
/// echoes the detected value back via
/// [`TranslateResp::detected_source_lang`](crate::translator::TranslateResp::detected_source_lang).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TranslateTextBody {
    /// Raw text to translate. Empty strings short-circuit to a 422.
    pub text: String,
    /// BCP-47 / ISO 639-1 target language code (e.g. `"en"`, `"hi"`,
    /// `"pt-BR"`).
    pub target_lang: String,
    /// Optional explicit source language. When omitted, the backend is
    /// expected to detect it.
    #[serde(default)]
    pub source_lang: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /detect`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/ai/translate/detect`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DetectBody {
    /// Raw text to inspect. Empty strings short-circuit to a 422.
    pub text: String,
}

// ---------------------------------------------------------------------------
// `POST /message`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/ai/translate/message`.
///
/// Looks up `messageId` under the caller's tenant, translates the text
/// content (only [`ContentBlock::Text`](sabchat_types::ContentBlock::Text)
/// blocks are translatable today — every other variant returns 422),
/// and persists the result under
/// `provider_metadata.translations[targetLang]`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TranslateMessageBody {
    /// Hex `ObjectId` string of the target `sabchat_messages` document.
    pub message_id: String,
    /// BCP-47 / ISO 639-1 target language code.
    pub target_lang: String,
}

/// Response envelope for `POST /v1/sabchat/ai/translate/message`.
///
/// We deliberately re-emit `messageId` so the shim does not have to
/// hold onto the request body when applying the result to the inbox UI.
/// `detectedSourceLang` mirrors the field on
/// [`TranslateResp`](crate::translator::TranslateResp) — the surface
/// can cache it on the contact for the next round trip.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TranslateMessageResponse {
    pub message_id: String,
    pub translated: String,
    pub detected_source_lang: String,
}
