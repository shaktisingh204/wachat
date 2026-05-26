use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SabsmsCampaignAudience {
    #[serde(rename = "segment")]
    Segment { segment_id: String },
    #[serde(rename = "contacts")]
    Contacts { contact_ids: Vec<String> },
    #[serde(rename = "csv")]
    Csv { sab_file_id: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SabsmsCampaignSchedule {
    #[serde(rename = "immediate")]
    Immediate,
    #[serde(rename = "scheduled")]
    Scheduled { send_at: DateTimeWithTimeZone },
    #[serde(rename = "recurring")]
    Recurring { cron: String },
    #[serde(rename = "drip")]
    Drip { drip_id: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsCampaignStats {
    pub total: i32,
    pub queued: i32,
    pub sent: i32,
    pub delivered: i32,
    pub failed: i32,
    pub replied: i32,
    pub clicked: i32,
    pub unsubscribed: i32,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "sabsms_campaigns")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workspace_id: String,
    pub name: String,
    pub template_id: Uuid,
    pub audience: SabsmsCampaignAudience,
    pub schedule: SabsmsCampaignSchedule,
    pub throttle_per_second: Option<i32>,
    pub sender_strategy: String,
    pub sender_number_ids: Option<Vec<String>>,
    pub category: String,
    pub status: String,
    pub stats: SabsmsCampaignStats,
    pub scheduled_at: Option<DateTimeWithTimeZone>,
    pub started_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
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
    #[sea_orm(has_many = "super::sabsms_messages::Entity")]
    SabsmsMessages,
}

impl Related<super::sabsms_templates::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsTemplates.def()
    }
}

impl Related<super::sabsms_messages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsMessages.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
