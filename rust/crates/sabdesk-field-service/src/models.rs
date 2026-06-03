use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPSLocation {
    pub lat: f64,
    pub lng: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPSRoute {
    pub route_id: Uuid,
    pub technician_id: Uuid,
    pub start_location: GPSLocation,
    pub end_location: Option<GPSLocation>,
    pub waypoints: Vec<GPSLocation>,
    pub estimated_duration_mins: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub item_id: Uuid,
    pub sku: String,
    pub name: String,
    pub quantity: i32,
    pub reserved_quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryVan {
    pub van_id: Uuid,
    pub license_plate: String,
    pub technician_id: Option<Uuid>,
    pub items: Vec<InventoryItem>,
    pub last_restocked: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub skill_name: String,
    pub level: i32, // 1 to 5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technician {
    pub technician_id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub skills: Vec<Skill>,
    pub current_van_id: Option<Uuid>,
    pub status: TechnicianStatus,
    pub current_location: Option<GPSLocation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TechnicianStatus {
    Available,
    OnRoute,
    OnSite,
    Break,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceLog {
    pub log_id: Uuid,
    pub work_order_id: Uuid,
    pub technician_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub log_type: String,
    pub description: String,
    pub time_spent_mins: i32,
    pub parts_used: Vec<Uuid>, // references InventoryItem item_id
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkOrder {
    pub work_order_id: Uuid,
    pub title: String,
    pub description: String,
    pub priority: WorkOrderPriority,
    pub status: WorkOrderStatus,
    pub location: GPSLocation,
    pub assigned_technician_id: Option<Uuid>,
    pub required_skills: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkOrderPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkOrderStatus {
    Pending,
    Scheduled,
    Dispatched,
    InProgress,
    Completed,
    Cancelled,
}
