use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TicketDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct CreateTicketDto {
    pub title: String,
    pub description: String,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateTicketDto {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}
