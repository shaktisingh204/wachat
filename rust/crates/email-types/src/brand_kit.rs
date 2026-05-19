use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandPalette {
    pub primary: String,
    #[serde(default)]
    pub secondary: Option<String>,
    #[serde(default)]
    pub background: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub muted: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandFonts {
    #[serde(default)]
    pub heading: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandFooter {
    pub company_name: String,
    pub address: String,
    #[serde(default)]
    pub unsubscribe_text: Option<String>,
    #[serde(default)]
    pub preferences_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandLogo {
    pub url: String,
    #[serde(default)]
    pub alt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandSocial {
    pub network: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandKit {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default)]
    pub logo: Option<EmailBrandLogo>,
    pub palette: EmailBrandPalette,
    pub fonts: EmailBrandFonts,
    #[serde(default)]
    pub social: Vec<EmailBrandSocial>,
    pub footer: EmailBrandFooter,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBrandKitInput {
    pub name: String,
    #[serde(default)]
    pub logo: Option<EmailBrandLogo>,
    pub palette: EmailBrandPalette,
    #[serde(default)]
    pub fonts: EmailBrandFonts,
    #[serde(default)]
    pub social: Vec<EmailBrandSocial>,
    pub footer: EmailBrandFooter,
}
