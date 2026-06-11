//! CSV exports for payments / refunds / settlements / orders.
//!
//! `GET /v1/sabpay/exports/{entity}?mode=&from=&to=` (JWT). Returns a
//! `text/csv` attachment scoped to the caller; `from`/`to` filter on
//! `createdAt` (ISO strings). Settlements are always live-mode.

use axum::{
    extract::{Path, Query, State},
    http::header,
    response::{IntoResponse, Response},
};
use bson::{Document, doc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;

use crate::store::{self, iso_opt, num_i64, str_or, user_oid};

const ROW_CAP: i64 = 5000;

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

/// CSV-escape a field: always quote, double internal quotes.
fn field(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\""))
}

fn row(cells: &[String]) -> String {
    let mut line = cells.join(",");
    line.push('\n');
    line
}

fn rupees(paise: i64) -> String {
    format!("{}.{:02}", paise / 100, (paise % 100).abs())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_field_quotes_and_escapes() {
        assert_eq!(field("plain"), "\"plain\"");
        assert_eq!(field("a,b"), "\"a,b\"");
        assert_eq!(field("say \"hi\""), "\"say \"\"hi\"\"\"");
    }

    #[test]
    fn rupees_formats_paise() {
        assert_eq!(rupees(12_345), "123.45");
        assert_eq!(rupees(100), "1.00");
        assert_eq!(rupees(5), "0.05");
        assert_eq!(rupees(0), "0.00");
    }
}

pub async fn export_csv(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(entity): Path<String>,
    Query(q): Query<ExportQuery>,
) -> Result<Response> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, "My business").await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();

    let (coll, mode_scoped) = match entity.as_str() {
        "payments" => (store::PAYMENTS, true),
        "refunds" => (store::REFUNDS, true),
        "orders" => (store::ORDERS, true),
        "settlements" => (store::SETTLEMENTS, false), // always live
        _ => {
            return Err(ApiError::BadRequest(
                "Export entity must be payments, refunds, orders, or settlements.".to_owned(),
            ));
        }
    };

    let mut filter = doc! { "userId": uid };
    if mode_scoped {
        filter.insert("mode", &mode);
    } else {
        filter.insert("mode", "live");
    }
    let mut created = Document::new();
    if let Some(f) = q.from.as_deref().filter(|s| !s.is_empty()) {
        created.insert("$gte", f);
    }
    if let Some(t) = q.to.as_deref().filter(|s| !s.is_empty()) {
        created.insert("$lte", t);
    }
    if !created.is_empty() {
        filter.insert("createdAt", created);
    }

    let cursor = mongo
        .collection::<Document>(coll)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(ROW_CAP)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.export.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.export.collect")))?;

    let (csv, filename) = match entity.as_str() {
        "payments" => {
            let mut out = row(&[
                field("id"), field("status"), field("amount"), field("currency"),
                field("customerEmail"), field("description"), field("fee"), field("tax"),
                field("amountRefunded"), field("createdAt"), field("paidAt"),
            ]);
            for d in &docs {
                out.push_str(&row(&[
                    field(&str_or(d, "paymentId", "")),
                    field(&str_or(d, "status", "")),
                    field(&rupees(num_i64(d, "amount"))),
                    field(&str_or(d, "currency", "INR")),
                    field(&str_or(d, "customerEmail", "")),
                    field(&str_or(d, "description", "")),
                    field(&rupees(num_i64(d, "fee"))),
                    field(&rupees(num_i64(d, "tax"))),
                    field(&rupees(num_i64(d, "amountRefunded"))),
                    field(&iso_opt(d, "createdAt").unwrap_or_default()),
                    field(&iso_opt(d, "paidAt").unwrap_or_default()),
                ]));
            }
            (out, "payments.csv")
        }
        "refunds" => {
            let mut out = row(&[
                field("id"), field("paymentId"), field("amount"), field("status"),
                field("createdAt"), field("processedAt"),
            ]);
            for d in &docs {
                out.push_str(&row(&[
                    field(&str_or(d, "refundId", "")),
                    field(&str_or(d, "paymentId", "")),
                    field(&rupees(num_i64(d, "amount"))),
                    field(&str_or(d, "status", "")),
                    field(&iso_opt(d, "createdAt").unwrap_or_default()),
                    field(&iso_opt(d, "processedAt").unwrap_or_default()),
                ]));
            }
            (out, "refunds.csv")
        }
        "orders" => {
            let mut out = row(&[
                field("id"), field("status"), field("amount"), field("amountPaid"),
                field("currency"), field("receipt"), field("createdAt"), field("paidAt"),
            ]);
            for d in &docs {
                out.push_str(&row(&[
                    field(&str_or(d, "orderId", "")),
                    field(&str_or(d, "status", "")),
                    field(&rupees(num_i64(d, "amount"))),
                    field(&rupees(num_i64(d, "amountPaid"))),
                    field(&str_or(d, "currency", "INR")),
                    field(&str_or(d, "receipt", "")),
                    field(&iso_opt(d, "createdAt").unwrap_or_default()),
                    field(&iso_opt(d, "paidAt").unwrap_or_default()),
                ]));
            }
            (out, "orders.csv")
        }
        _ => {
            let mut out = row(&[
                field("id"), field("net"), field("gross"), field("fees"), field("tax"),
                field("refunds"), field("disputesDeducted"), field("paymentCount"),
                field("utr"), field("periodEnd"), field("settledAt"),
            ]);
            for d in &docs {
                out.push_str(&row(&[
                    field(&str_or(d, "setlId", "")),
                    field(&rupees(num_i64(d, "amount"))),
                    field(&rupees(num_i64(d, "grossAmount"))),
                    field(&rupees(num_i64(d, "feesTotal"))),
                    field(&rupees(num_i64(d, "taxTotal"))),
                    field(&rupees(num_i64(d, "refundsTotal"))),
                    field(&rupees(num_i64(d, "disputesDeducted"))),
                    field(&num_i64(d, "paymentCount").to_string()),
                    field(&str_or(d, "utr", "")),
                    field(&str_or(d, "periodEnd", "")),
                    field(&iso_opt(d, "settledAt").unwrap_or_default()),
                ]));
            }
            (out, "settlements.csv")
        }
    };

    let disposition = match filename {
        "payments.csv" => "attachment; filename=\"sabpay-payments.csv\"",
        "refunds.csv" => "attachment; filename=\"sabpay-refunds.csv\"",
        "orders.csv" => "attachment; filename=\"sabpay-orders.csv\"",
        _ => "attachment; filename=\"sabpay-settlements.csv\"",
    };
    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        csv,
    )
        .into_response())
}
