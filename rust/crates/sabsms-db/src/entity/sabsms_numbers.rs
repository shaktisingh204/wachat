use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct NumberCapabilities {
    pub sms: bool,
    pub mms: bool,
    pub rcs: bool,
    pub voice: bool,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "sabsms_numbers")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workspace_id: String,
    pub e164: String,
    pub country: String,
    pub r#type: String,
    pub provider: String,
    pub provider_number_id: Option<String>,
    pub capabilities: NumberCapabilities,
    pub status: String,
    pub monthly_cost: Option<i32>,
    pub created_at: DateTimeWithTimeZone,
    pub released_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
