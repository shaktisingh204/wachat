use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct AutomationDto {
    pub id: String,
    pub name: String,
    pub trigger: String,
    pub action: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CreateAutomationDto {
    pub name: String,
    pub trigger: String,
    pub action: String,
    pub enabled: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateAutomationDto {
    pub name: Option<String>,
    pub trigger: Option<String>,
    pub action: Option<String>,
    pub enabled: Option<bool>,
}
