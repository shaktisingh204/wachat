//! Quiet-hours table (V2.4A) — marketing-only send windows per country.
//!
//! - **IN** — TRAI: promotional SMS only 10:00–21:00 IST, STRICT. India
//!   has a single timezone so this is exact.
//! - **US / CA** — TCPA-style 08:00–21:00 *recipient-local*, but we do
//!   NOT yet resolve area-code → timezone. Instead we use a CONSERVATIVE
//!   single-window approximation: the message must be legal in EVERY
//!   continental zone simultaneously, i.e. it must be past 08:00 in the
//!   westernmost zone (America/Los_Angeles) AND before 21:00 in the
//!   easternmost zone (America/New_York). Effectively that is
//!   11:00–21:00 ET (08:00–18:00 PT) — strictly narrower than what's
//!   legal for any single recipient, so we can never send into someone's
//!   quiet hours; we only delay some legal sends. Canada gets the same
//!   treatment with Vancouver/St. John's as the bounding zones.
//! - Every other country — no restriction (compliance packs land in
//!   later phases).
//!
//! Only `MessageCategory::Marketing` is restricted; transactional / OTP /
//! alert / service messages are exempt.

use chrono::{DateTime, Datelike, Days, LocalResult, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

use crate::types::MessageCategory;

/// A promo send window. Allowed iff `now >= start (in start_tz)` AND
/// `now < end (in end_tz)`. Single-tz countries use the same tz twice;
/// multi-tz countries (US/CA) use the most-restrictive pair — see the
/// module docs for why this is intentionally conservative.
pub struct CountryWindow {
    pub country: &'static str,
    pub start_tz: Tz,
    /// (hour, minute) local to `start_tz`.
    pub start_hm: (u32, u32),
    pub end_tz: Tz,
    /// (hour, minute) local to `end_tz` (exclusive).
    pub end_hm: (u32, u32),
}

/// Static country → window table. Countries absent here have no
/// engine-enforced quiet hours.
pub static WINDOWS: &[CountryWindow] = &[
    // TRAI: promotional 10:00–21:00 IST, strict.
    CountryWindow {
        country: "IN",
        start_tz: chrono_tz::Asia::Kolkata,
        start_hm: (10, 0),
        end_tz: chrono_tz::Asia::Kolkata,
        end_hm: (21, 0),
    },
    // Conservative continental-US window: 08:00 Pacific .. 21:00 Eastern
    // (≡ legal in ALL continental zones; ~11:00–21:00 ET).
    CountryWindow {
        country: "US",
        start_tz: chrono_tz::America::Los_Angeles,
        start_hm: (8, 0),
        end_tz: chrono_tz::America::New_York,
        end_hm: (21, 0),
    },
    // Same conservatism for Canada: 08:00 Pacific .. 21:00 Newfoundland.
    CountryWindow {
        country: "CA",
        start_tz: chrono_tz::America::Vancouver,
        start_hm: (8, 0),
        end_tz: chrono_tz::America::St_Johns,
        end_hm: (21, 0),
    },
];

/// Check quiet hours for a destination country + message category.
///
/// Returns `None` when sending is allowed right now, or
/// `Some(next_allowed_instant)` when the message must be rescheduled.
pub fn check_quiet_hours(
    country: &str,
    category: MessageCategory,
    now_utc: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    // Marketing only — transactional/otp/alert/service are exempt.
    if category != MessageCategory::Marketing {
        return None;
    }
    let w = WINDOWS.iter().find(|w| w.country == country)?;

    let start_local = now_utc.with_timezone(&w.start_tz);
    let end_local = now_utc.with_timezone(&w.end_tz);
    let after_start = (start_local.hour(), start_local.minute()) >= w.start_hm;
    let before_end = (end_local.hour(), end_local.minute()) < w.end_hm;
    if after_start && before_end {
        return None;
    }

    // Next allowed instant = the next window-start boundary (in the
    // start tz) strictly after `now`. At that instant the end condition
    // always holds too (the windows are non-empty by construction).
    let date = start_local.date_naive();
    let mut candidate = local_instant(w.start_tz, date, w.start_hm);
    if candidate <= now_utc {
        candidate = local_instant(
            w.start_tz,
            date.checked_add_days(Days::new(1)).unwrap_or(date),
            w.start_hm,
        );
    }
    Some(candidate)
}

/// Resolve a local wall-clock time to a UTC instant, handling DST
/// ambiguity (take the earlier) and DST gaps (push one hour later —
/// US/CA transitions happen at 02:00 so our 08:00/10:00 boundaries never
/// actually hit a gap; this is defensive).
fn local_instant(tz: Tz, date: NaiveDate, (h, m): (u32, u32)) -> DateTime<Utc> {
    match tz.with_ymd_and_hms(date.year(), date.month(), date.day(), h, m, 0) {
        LocalResult::Single(dt) => dt.with_timezone(&Utc),
        LocalResult::Ambiguous(earliest, _) => earliest.with_timezone(&Utc),
        LocalResult::None => tz
            .with_ymd_and_hms(date.year(), date.month(), date.day(), h + 1, m, 0)
            .earliest()
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
    }

    // ---- IN (IST = UTC+5:30, no DST) ----

    #[test]
    fn in_marketing_at_2200_ist_reschedules_to_next_1000_ist() {
        // 22:00 IST on 2026-06-10 == 16:30 UTC.
        let now = utc(2026, 6, 10, 16, 30);
        let until = check_quiet_hours("IN", MessageCategory::Marketing, now)
            .expect("must be rescheduled");
        // Next 10:00 IST = 2026-06-11T04:30:00Z.
        assert_eq!(until, utc(2026, 6, 11, 4, 30));
    }

    #[test]
    fn in_marketing_before_window_reschedules_to_same_day_1000_ist() {
        // 09:00 IST == 03:30 UTC.
        let now = utc(2026, 6, 10, 3, 30);
        let until = check_quiet_hours("IN", MessageCategory::Marketing, now)
            .expect("must be rescheduled");
        // Same day 10:00 IST = 04:30 UTC.
        assert_eq!(until, utc(2026, 6, 10, 4, 30));
    }

    #[test]
    fn in_marketing_inside_window_is_allowed() {
        // 14:00 IST == 08:30 UTC.
        let now = utc(2026, 6, 10, 8, 30);
        assert_eq!(check_quiet_hours("IN", MessageCategory::Marketing, now), None);
    }

    #[test]
    fn in_marketing_at_exactly_2100_ist_is_blocked() {
        // 21:00 IST == 15:30 UTC — end is exclusive.
        let now = utc(2026, 6, 10, 15, 30);
        let until = check_quiet_hours("IN", MessageCategory::Marketing, now)
            .expect("21:00 sharp is already quiet");
        assert_eq!(until, utc(2026, 6, 11, 4, 30));
    }

    #[test]
    fn in_transactional_at_2200_ist_is_allowed() {
        let now = utc(2026, 6, 10, 16, 30);
        assert_eq!(
            check_quiet_hours("IN", MessageCategory::Transactional, now),
            None
        );
        assert_eq!(check_quiet_hours("IN", MessageCategory::Otp, now), None);
        assert_eq!(check_quiet_hours("IN", MessageCategory::Alert, now), None);
        assert_eq!(check_quiet_hours("IN", MessageCategory::Service, now), None);
    }

    // ---- US conservative window (June = DST: LA = UTC-7, NY = UTC-4) ----

    #[test]
    fn us_marketing_before_0800_pacific_reschedules_to_same_day_0800_la() {
        // 06:00 LA == 13:00 UTC (09:00 NY — fine on the east side, but
        // the conservative window requires 08:00 LA).
        let now = utc(2026, 6, 10, 13, 0);
        let until = check_quiet_hours("US", MessageCategory::Marketing, now)
            .expect("must be rescheduled");
        // 08:00 LA same day = 15:00 UTC.
        assert_eq!(until, utc(2026, 6, 10, 15, 0));
    }

    #[test]
    fn us_marketing_midday_is_allowed() {
        // 16:00 UTC == 09:00 LA / 12:00 NY — inside the conservative window.
        let now = utc(2026, 6, 10, 16, 0);
        assert_eq!(check_quiet_hours("US", MessageCategory::Marketing, now), None);
    }

    #[test]
    fn us_marketing_after_2100_eastern_reschedules_to_next_day_0800_la() {
        // 2026-06-11T01:30Z == June 10 18:30 LA / June 10 21:30 NY —
        // past 21:00 Eastern, so blocked even though it's evening in LA.
        let now = utc(2026, 6, 11, 1, 30);
        let until = check_quiet_hours("US", MessageCategory::Marketing, now)
            .expect("must be rescheduled");
        // Next 08:00 LA = June 11 15:00 UTC.
        assert_eq!(until, utc(2026, 6, 11, 15, 0));
    }

    #[test]
    fn us_marketing_at_exactly_2100_eastern_is_blocked() {
        // 2026-06-11T01:00Z == 21:00 NY sharp (18:00 LA) — exclusive end.
        let now = utc(2026, 6, 11, 1, 0);
        assert!(check_quiet_hours("US", MessageCategory::Marketing, now).is_some());
    }

    #[test]
    fn us_transactional_is_always_allowed() {
        let now = utc(2026, 6, 11, 1, 30); // blocked instant for marketing
        assert_eq!(
            check_quiet_hours("US", MessageCategory::Transactional, now),
            None
        );
    }

    // ---- CA conservative window ----

    #[test]
    fn ca_marketing_late_night_is_rescheduled() {
        // 2026-06-11T02:00Z == June 10 23:30 St. John's (NDT, UTC-2:30) —
        // way past 21:00 in the easternmost zone.
        let now = utc(2026, 6, 11, 2, 0);
        let until = check_quiet_hours("CA", MessageCategory::Marketing, now)
            .expect("must be rescheduled");
        // Next 08:00 Vancouver (PDT, UTC-7) = June 11 15:00 UTC.
        assert_eq!(until, utc(2026, 6, 11, 15, 0));
    }

    // ---- Unrestricted countries ----

    #[test]
    fn unrestricted_country_marketing_is_always_allowed() {
        let midnight = utc(2026, 6, 10, 23, 0);
        assert_eq!(
            check_quiet_hours("GB", MessageCategory::Marketing, midnight),
            None
        );
        assert_eq!(
            check_quiet_hours("DE", MessageCategory::Marketing, midnight),
            None
        );
        assert_eq!(
            check_quiet_hours("UNK", MessageCategory::Marketing, midnight),
            None
        );
    }
}
