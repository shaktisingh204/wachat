use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateBody {
    pub locale: String,
    pub body: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateDlt {
    pub principal_entity_id: Option<String>,
    pub template_id: Option<String>,
    pub header_id: Option<String>,
    pub content_category: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct SabsmsTemplateTendlc {
    pub brand_id: Option<String>,
    pub campaign_id: Option<String>,
    pub use_case: Option<String>,
    pub sample_messages: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "sabsms_templates")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workspace_id: String,
    pub name: String,
    pub category: String,
    pub bodies: Vec<SabsmsTemplateBody>,
    pub variables: Option<Vec<String>>,
    pub status: String,
    pub reviewer_notes: Option<String>,
    pub dlt: Option<SabsmsTemplateDlt>,
    pub tendlc: Option<SabsmsTemplateTendlc>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::sabsms_campaigns::Entity")]
    SabsmsCampaigns,
    #[sea_orm(has_many = "super::sabsms_messages::Entity")]
    SabsmsMessages,
}

impl Related<super::sabsms_campaigns::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsCampaigns.def()
    }
}

impl Related<super::sabsms_messages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SabsmsMessages.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
