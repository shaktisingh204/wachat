//! Pure-function business-hours evaluator.
//!
//! Given a set of weekly windows, a list of holiday dates (already
//! union'd across the calendar's own list + the tenant's
//! `crm_holidays`), the calendar's IANA timezone, and a `now` instant
//! in UTC, decides whether the inbox is currently open and (when
//! closed) when it will open next.
//!
//! ## Time math
//!
//! 1. Convert `now` into the calendar's local timezone via
//!    [`chrono_tz::Tz`].
//! 2. Compare `local.date_naive()` (`YYYY-MM-DD`) against the holiday
//!    list — a match short-circuits to [`OpenReason::Holiday`].
//! 3. Compute the local weekday with
//!    [`chrono::Datelike::weekday`].`num_days_from_sunday()` — this is
//!    intentionally Sunday-indexed to match the wire `day: 0..6` shape.
//! 4. For each window whose `day` matches, parse `open` / `close` and
//!    test `open <= now_minutes < close`. Overnight windows
//!    (`close < open`) are treated as "open until 23:59 today AND
//!    00:00..close tomorrow", but for the simple "are we in this
//!    window right now" check we just split into two ranges relative
//!    to today.
//! 5. If no window matches, scan forward up to seven days for the
//!    next window opening to populate `next_open_at`.
//!
//! ## What this module does **not** do
//!
//! No I/O. No Mongo. No auth. Callers in [`crate::handlers`] are
//! responsible for loading the calendar / inbox / holiday rows and
//! handing the materialized inputs in. That separation keeps the
//! eval testable in isolation and lets the public [`is_open`](crate::is_open)
//! helper reuse the same kernel.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc, Weekday};
use chrono_tz::Tz;

use crate::dto::{CalendarWindow, OpenReason, OpenStatus};

/// Evaluate `windows` + `holidays` against the wall-clock instant `now`.
///
/// - `windows` — weekly window slots; `day` is Sunday-indexed (0..=6).
/// - `holidays` — `YYYY-MM-DD` strings in **local** calendar dates.
/// - `tz` — IANA timezone string. Falls back to UTC if the string
///   does not parse — the handler layer is responsible for surfacing
///   that as a validation error before reaching this fn, but the
///   defensive fallback keeps the kernel total.
/// - `now` — wall-clock instant in UTC.
pub(crate) fn eval_against(
    windows: &[CalendarWindow],
    holidays: &[String],
    tz: &str,
    now: DateTime<Utc>,
) -> OpenStatus {
    // Parse the IANA timezone — defensively fall back to UTC. The
    // handler validates the string before this is called; the fallback
    // is here so unit tests / future direct callers can't panic.
    let zone: Tz = tz.parse::<Tz>().unwrap_or(chrono_tz::UTC);
    let local = now.with_timezone(&zone);

    // ---- 1. Holiday check -------------------------------------------
    let today_ymd = local.date_naive().format("%Y-%m-%d").to_string();
    if holidays.iter().any(|h| h == &today_ymd) {
        return OpenStatus {
            open: false,
            next_open_at: next_open_after(windows, holidays, &zone, now),
            reason: OpenReason::Holiday,
        };
    }

    // ---- 2. Inside-window check -------------------------------------
    let today_dow = weekday_num(local.weekday());
    let now_minutes = local.hour() as i32 * 60 + local.minute() as i32;

    for w in windows {
        if w.day != today_dow {
            continue;
        }
        let Some(open) = parse_hhmm(&w.open) else {
            continue;
        };
        let Some(close) = parse_hhmm(&w.close) else {
            continue;
        };
        if close > open {
            // Same-day window.
            if now_minutes >= open && now_minutes < close {
                return OpenStatus {
                    open: true,
                    next_open_at: None,
                    reason: OpenReason::InsideWindow,
                };
            }
        } else if close < open {
            // Overnight window (e.g. 22:00..02:00). For the
            // "right now" check this means we're open if
            // `now >= open` (late tonight) — the tail
            // (`now < close` after midnight) is matched on the
            // *next* day's window slot, which the caller is
            // expected to also have configured. We deliberately
            // do not auto-expand here; that keeps the eval
            // deterministic against the persisted windows.
            if now_minutes >= open {
                return OpenStatus {
                    open: true,
                    next_open_at: None,
                    reason: OpenReason::InsideWindow,
                };
            }
        }
        // `close == open` is a zero-duration window — treat as closed.
    }

    // Also check yesterday's overnight tail (e.g. yesterday's
    // 22:00..02:00 window with today now=01:00).
    let yesterday_dow = (today_dow + 6) % 7; // mod 7 wraparound, Sunday-indexed.
    for w in windows {
        if w.day != yesterday_dow {
            continue;
        }
        let Some(open) = parse_hhmm(&w.open) else {
            continue;
        };
        let Some(close) = parse_hhmm(&w.close) else {
            continue;
        };
        if close < open && now_minutes < close {
            return OpenStatus {
                open: true,
                next_open_at: None,
                reason: OpenReason::InsideWindow,
            };
        }
    }

    // ---- 3. Closed — find next opening ------------------------------
    OpenStatus {
        open: false,
        next_open_at: next_open_after(windows, holidays, &zone, now),
        reason: OpenReason::OutsideWindow,
    }
}

/// Scan forward up to seven days looking for the next window opening
/// that is **not** on a holiday. Returns `None` when no windows are
/// configured or no opening exists in the next seven days.
fn next_open_after(
    windows: &[CalendarWindow],
    holidays: &[String],
    zone: &Tz,
    now: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    if windows.is_empty() {
        return None;
    }

    let local_now = now.with_timezone(zone);

    // Look ahead 8 candidate days (today + next 7) so we always find
    // an opening when at least one window exists and that window isn't
    // permanently holiday-shadowed.
    for offset in 0..=7i64 {
        let candidate_date: NaiveDate =
            (local_now.date_naive()).checked_add_signed(Duration::days(offset))?;
        let candidate_ymd = candidate_date.format("%Y-%m-%d").to_string();
        if holidays.iter().any(|h| h == &candidate_ymd) {
            continue;
        }
        let dow = weekday_num(candidate_date.weekday());

        // Collect every matching `open` time (in minutes-of-day) for
        // this weekday — there may be more than one (morning + evening
        // split) so we pick the earliest that is still in the future.
        let mut earliest: Option<i32> = None;
        for w in windows {
            if w.day != dow {
                continue;
            }
            let Some(open_min) = parse_hhmm(&w.open) else {
                continue;
            };
            // On the same day as `now`, skip windows that have
            // already opened (their `open` minute is <= the current
            // minute). On future days, all windows are eligible.
            if offset == 0 {
                let now_min = local_now.hour() as i32 * 60 + local_now.minute() as i32;
                if open_min <= now_min {
                    continue;
                }
            }
            earliest = Some(match earliest {
                Some(prev) if prev <= open_min => prev,
                _ => open_min,
            });
        }

        if let Some(open_min) = earliest {
            let hour = (open_min / 60) as u32;
            let minute = (open_min % 60) as u32;
            // Materialize the local datetime; resolve to UTC. We use
            // `.single()` and fall back to `.earliest()` for the
            // ambiguous DST-spring-forward case.
            let local_dt = zone
                .with_ymd_and_hms(
                    candidate_date.year(),
                    candidate_date.month(),
                    candidate_date.day(),
                    hour,
                    minute,
                    0,
                )
                .single()
                .or_else(|| {
                    zone.with_ymd_and_hms(
                        candidate_date.year(),
                        candidate_date.month(),
                        candidate_date.day(),
                        hour,
                        minute,
                        0,
                    )
                    .earliest()
                })?;
            return Some(local_dt.with_timezone(&Utc));
        }
    }

    None
}

/// Parse an `HH:MM` 24-hour string into total minutes-of-day (0..1440).
/// Returns `None` for any malformed input — the handler validates
/// strings up front, so a `None` here downgrades to "skip this
/// window" rather than blowing up the whole eval.
fn parse_hhmm(s: &str) -> Option<i32> {
    let bytes = s.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return None;
    }
    let parse2 = |a: u8, b: u8| -> Option<i32> {
        if !a.is_ascii_digit() || !b.is_ascii_digit() {
            return None;
        }
        Some(((a - b'0') as i32) * 10 + ((b - b'0') as i32))
    };
    let hh = parse2(bytes[0], bytes[1])?;
    let mm = parse2(bytes[3], bytes[4])?;
    if hh > 23 || mm > 59 {
        return None;
    }
    Some(hh * 60 + mm)
}

/// `chrono::Weekday` → Sunday-indexed `u8` (0..=6). Matches the
/// `BusinessHoursWindow.day` field on the wire.
fn weekday_num(w: Weekday) -> u8 {
    match w {
        Weekday::Sun => 0,
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn win(day: u8, open: &str, close: &str) -> CalendarWindow {
        CalendarWindow {
            day,
            open: open.to_owned(),
            close: close.to_owned(),
        }
    }

    #[test]
    fn parse_hhmm_round_trip() {
        assert_eq!(parse_hhmm("00:00"), Some(0));
        assert_eq!(parse_hhmm("09:30"), Some(9 * 60 + 30));
        assert_eq!(parse_hhmm("23:59"), Some(23 * 60 + 59));
        assert_eq!(parse_hhmm("24:00"), None);
        assert_eq!(parse_hhmm("9:30"), None);
        assert_eq!(parse_hhmm(""), None);
    }

    #[test]
    fn inside_same_day_window_is_open() {
        // Wednesday 2026-05-27 at 10:00 UTC.
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 10, 0, 0).unwrap();
        let windows = vec![win(3, "09:00", "17:00")]; // Wed
        let status = eval_against(&windows, &[], "UTC", now);
        assert!(status.open);
        assert_eq!(status.reason, OpenReason::InsideWindow);
        assert!(status.next_open_at.is_none());
    }

    #[test]
    fn before_window_returns_next_open_today() {
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 7, 0, 0).unwrap();
        let windows = vec![win(3, "09:00", "17:00")];
        let status = eval_against(&windows, &[], "UTC", now);
        assert!(!status.open);
        assert_eq!(status.reason, OpenReason::OutsideWindow);
        let next = status.next_open_at.expect("must have next");
        assert_eq!(next.hour(), 9);
        assert_eq!(next.day(), 27);
    }

    #[test]
    fn after_window_rolls_to_next_matching_day() {
        // Wednesday at 18:00 with only-Wed window → next Wed.
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 18, 0, 0).unwrap();
        let windows = vec![win(3, "09:00", "17:00")];
        let status = eval_against(&windows, &[], "UTC", now);
        assert!(!status.open);
        let next = status.next_open_at.expect("must have next");
        // 7 days later is the next Wednesday.
        assert_eq!(next.day(), 3); // June 3, 2026 is Wed.
    }

    #[test]
    fn holiday_short_circuits_to_closed() {
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 10, 0, 0).unwrap();
        let windows = vec![win(3, "09:00", "17:00")];
        let status = eval_against(&windows, &["2026-05-27".to_owned()], "UTC", now);
        assert!(!status.open);
        assert_eq!(status.reason, OpenReason::Holiday);
    }

    #[test]
    fn empty_windows_returns_no_next_open() {
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 10, 0, 0).unwrap();
        let status = eval_against(&[], &[], "UTC", now);
        assert!(!status.open);
        assert!(status.next_open_at.is_none());
        assert_eq!(status.reason, OpenReason::OutsideWindow);
    }

    #[test]
    fn timezone_shifts_evaluation_window() {
        // 2026-05-27 03:00 UTC == 08:30 IST (Asia/Kolkata).
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 3, 0, 0).unwrap();
        // IST Wednesday 09:00-17:00 — 08:30 IST is BEFORE open.
        let windows = vec![win(3, "09:00", "17:00")];
        let status = eval_against(&windows, &[], "Asia/Kolkata", now);
        assert!(!status.open);
        assert_eq!(status.reason, OpenReason::OutsideWindow);
    }

    #[test]
    fn overnight_window_open_after_open_minute() {
        // Wed 23:00 UTC, with Wed 22:00..02:00 overnight window.
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 23, 0, 0).unwrap();
        let windows = vec![win(3, "22:00", "02:00")];
        let status = eval_against(&windows, &[], "UTC", now);
        assert!(status.open);
    }

    #[test]
    fn overnight_window_tail_open_next_morning() {
        // Thu 01:00 UTC catches Wednesday's 22:00..02:00 tail.
        let now = Utc.with_ymd_and_hms(2026, 5, 28, 1, 0, 0).unwrap();
        let windows = vec![win(3, "22:00", "02:00")]; // Wed
        let status = eval_against(&windows, &[], "UTC", now);
        assert!(status.open);
    }
}
