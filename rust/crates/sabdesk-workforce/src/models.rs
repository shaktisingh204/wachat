use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentShift {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub shift_type: ShiftType,
    pub location: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ShiftType {
    Regular,
    Overtime,
    OnCall,
    Training,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeOffRequest {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub request_type: TimeOffType,
    pub status: ApprovalStatus,
    pub reason: String,
    pub submitted_at: DateTime<Utc>,
    pub approved_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TimeOffType {
    Vacation,
    SickLeave,
    PersonalLeave,
    Bereavement,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastingModel {
    pub id: Uuid,
    pub name: String,
    pub target_date: DateTime<Utc>,
    pub expected_volume: u32,
    pub required_agents: u32,
    pub accuracy_score: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendanceLog {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub shift_id: Uuid,
    pub clock_in: Option<DateTime<Utc>>,
    pub clock_out: Option<DateTime<Utc>>,
    pub total_hours: Option<f32>,
    pub status: AttendanceStatus,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AttendanceStatus {
    OnTime,
    Late,
    Absent,
    Excused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftSwapRequest {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub target_agent_id: Uuid,
    pub requester_shift_id: Uuid,
    pub target_shift_id: Uuid,
    pub status: ApprovalStatus,
    pub requested_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgentShiftRequest {
    pub agent_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub shift_type: ShiftType,
    pub location: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTimeOffRequest {
    pub agent_id: Uuid,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub request_type: TimeOffType,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApprovalStatusRequest {
    pub status: ApprovalStatus,
    pub approved_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateForecastingModelRequest {
    pub name: String,
    pub target_date: DateTime<Utc>,
    pub expected_volume: u32,
    pub required_agents: u32,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockInRequest {
    pub agent_id: Uuid,
    pub shift_id: Uuid,
    pub time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockOutRequest {
    pub time: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateShiftSwapRequest {
    pub requester_id: Uuid,
    pub target_agent_id: Uuid,
    pub requester_shift_id: Uuid,
    pub target_shift_id: Uuid,
}
