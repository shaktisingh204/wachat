use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::handlers::*;
use crate::mock_db::DbState;

pub fn create_router(db_state: DbState) -> Router {
    Router::new()
        // Shifts
        .route("/shifts", post(create_shift).get(list_shifts))
        .route("/shifts/:id", get(get_shift).put(update_shift).delete(delete_shift))
        
        // Time Off
        .route("/time_off", post(create_time_off).get(list_time_off))
        .route("/time_off/:id", get(get_time_off).delete(delete_time_off))
        .route("/time_off/:id/status", put(update_time_off_status))
        
        // Forecasting
        .route("/forecasts", post(create_forecast).get(list_forecasts))
        .route("/forecasts/:id", get(get_forecast).put(update_forecast).delete(delete_forecast))
        
        // Attendance
        .route("/attendance", get(list_attendance))
        .route("/attendance/clock_in", post(clock_in))
        .route("/attendance/:id/clock_out", put(clock_out))
        .route("/attendance/:id", get(get_attendance))
        
        // Shift Swaps
        .route("/shift_swaps", post(create_shift_swap).get(list_shift_swaps))
        .route("/shift_swaps/:id", get(get_shift_swap))
        .route("/shift_swaps/:id/status", put(update_shift_swap_status))
        
        .with_state(db_state)
}
