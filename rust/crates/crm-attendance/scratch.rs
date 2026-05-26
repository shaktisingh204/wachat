use chrono::{Datelike, TimeZone, Utc};

fn main() {
    let now = Utc::now();
    let later = now + chrono::Duration::hours(2);
    let dur = later.signed_duration_since(now);
    println!("hours: {}", dur.num_minutes() as f64 / 60.0);
}
