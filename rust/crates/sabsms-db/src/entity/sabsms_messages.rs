use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsMedia {
    pub sab_file_id: String,
    pub mime: String,
    pub bytes: i64,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "sabsms_messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workspace_id: String,
    pub idempotency_key: Option<String>,
    pub direction: String,
    pub channel: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub media: Option<Vec<SabsmsMedia>>,
    pub category: String,
    pub status: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub provider: String,
    pub provider_account_id: Option<String>,
    pub provider_message_id: Option<String>,
    pub template_id: Option<Uuid>,
    pub campaign_id: Option<Uuid>,
    pub conversation_id: Option<String>,
    pub contact_id: Option<String>,
    pub event_key: Option<String>,
    pub segments_count: Option<i32>,
    pub price: Option<i32>,
    pub cost: Option<i32>,
    pub tags: Option<Vec<String>>,
    pub queued_at: Option<DateTimeWithTimeZone>,
    pub sent_at: Option<DateTimeWithTimeZone>,
    pub delivered_at: Option<DateTimeWithTimeZone>,
    pub failed_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::sabsms_templates::Entity",
        from = "Column::TemplateId",
        to = "super::sabsms_templates::Column::Id"
    )]
    SabsmsTemplates,
    #[sea_orm(
        belongs_to = "super::sabsms_campaigns::Entity",
        from = "Column::CampaignId",
        to = "super::sabsms_campaigns::Column::Id"
    )]
    SabsmsCampaigns,
}

impl Related<super::sabsms_templates::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsTemplates.def()
    }
}

impl Related<super::sabsms_campaigns::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsCampaigns.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
