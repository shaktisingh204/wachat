use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{GPSRoute, InventoryVan, ServiceLog, Technician, WorkOrder};

#[derive(Debug, Default)]
pub struct MockDatabase {
    pub technicians: HashMap<Uuid, Technician>,
    pub work_orders: HashMap<Uuid, WorkOrder>,
    pub vans: HashMap<Uuid, InventoryVan>,
    pub routes: HashMap<Uuid, GPSRoute>,
    pub service_logs: HashMap<Uuid, ServiceLog>,
}

impl MockDatabase {
    pub fn new() -> Self {
        Self {
            technicians: HashMap::new(),
            work_orders: HashMap::new(),
            vans: HashMap::new(),
            routes: HashMap::new(),
            service_logs: HashMap::new(),
        }
    }
}

pub type DbState = Arc<RwLock<MockDatabase>>;

pub fn create_db_state() -> DbState {
    Arc::new(RwLock::new(MockDatabase::new()))
}
