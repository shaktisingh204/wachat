//! SabPay Customers — `cust_…` objects. Full CRUD; payments/subscriptions/
//! invoices reference `customerId`. Hard delete leaves dangling references
//! (Razorpay-like). Mirrors the `orders` reference module.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ids::new_id;
use crate::store::{self, doc_to_payment, iso_opt, str_opt, str_or, user_oid, validate_notes};

const COLL: &str = store::CUSTOMERS;
const DEFAULT_NAME: &str = "My business";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerOut {
    pub id: String,
    pub mode: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerBody {
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub contact: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomerBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub contact: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct CustomerList {
    pub customers: Vec<CustomerOut>,
}

pub fn doc_to_customer(d: &Document) -> CustomerOut {
    CustomerOut {
        id: str_or(d, "customerId", ""),
        mode: str_or(d, "mode", "test"),
        name: str_or(d, "name", ""),
        email: str_opt(d, "email"),
        contact: str_opt(d, "contact"),
        gstin: str_opt(d, "gstin"),
        notes: match d.get("notes") {
            Some(b) if !matches!(b, Bson::Null) => {
                let v = bson_to_clean_json(b.clone());
                if v.is_null() { None } else { Some(v) }
            }
            _ => None,
        },
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
    }
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "customerId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.get")))
}

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<CustomerList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let mut filter = doc! { "userId": uid, "mode": &mode };
    if let Some(s) = q.search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let rx = doc! { "$regex": regex_escape(s), "$options": "i" };
        filter.insert("$or", bson::Bson::Array(vec![
            Bson::Document(doc! { "name": rx.clone() }),
            Bson::Document(doc! { "email": rx.clone() }),
            Bson::Document(doc! { "contact": rx }),
        ]));
    }
    if let Some(b) = q.before.as_deref() {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(q.limit.unwrap_or(50).clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.collect")))?;
    Ok(Json(CustomerList {
        customers: docs.iter().map(doc_to_customer).collect(),
    }))
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if "\\^$.|?*+()[]{}".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateCustomerBody>,
) -> Result<Json<CustomerOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };
    let name: String = body.name.trim().chars().take(140).collect();
    if name.is_empty() {
        return Err(ApiError::Validation("Customer name is required.".to_owned()));
    }
    let notes = validate_notes(&body.notes)?;
    let id = new_id("cust");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "customerId": &id,
        "userId": uid,
        "mode": &mode,
        "name": &name,
        "createdAt": &now,
        "updatedAt": &now,
    };
    insert_optional(&mut d, "email", body.email.as_deref(), 200);
    insert_optional(&mut d, "contact", body.contact.as_deref(), 20);
    insert_optional(&mut d, "gstin", body.gstin.as_deref(), 20);
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.insert")))?;
    Ok(Json(doc_to_customer(&d)))
}

fn insert_optional(d: &mut Document, key: &str, value: Option<&str>, cap: usize) {
    if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
        d.insert(key, v.chars().take(cap).collect::<String>());
    }
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<CustomerOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No customer \"{id}\".")))?;
    Ok(Json(doc_to_customer(&d)))
}

pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCustomerBody>,
) -> Result<Json<CustomerOut>> {
    let uid = user_oid(&user)?;
    let notes = validate_notes(&body.notes)?;
    let mut set = doc! { "updatedAt": store::now_iso() };
    if let Some(name) = body.name.as_deref().map(str::trim) {
        if name.is_empty() {
            return Err(ApiError::Validation("Customer name cannot be empty.".to_owned()));
        }
        set.insert("name", name.chars().take(140).collect::<String>());
    }
    for (key, value, cap) in [
        ("email", &body.email, 200usize),
        ("contact", &body.contact, 20),
        ("gstin", &body.gstin, 20),
    ] {
        if let Some(v) = value {
            let t = v.trim();
            if t.is_empty() {
                set.insert(key, Bson::Null);
            } else {
                set.insert(key, t.chars().take(cap).collect::<String>());
            }
        }
    }
    if let Some(n) = notes {
        set.insert("notes", n);
    }
    let res = mongo
        .collection::<Document>(COLL)
        .update_one(doc! { "customerId": &id, "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("No customer \"{id}\".")));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No customer \"{id}\".")))?;
    Ok(Json(doc_to_customer(&d)))
}

pub async fn delete_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::dto::Ack>> {
    let uid = user_oid(&user)?;
    let res = mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "customerId": &id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.delete")))?;
    if res.deleted_count == 1 {
        Ok(Json(crate::dto::Ack::ok()))
    } else {
        Err(ApiError::NotFound(format!("No customer \"{id}\".")))
    }
}

pub async fn payments_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let uid = user_oid(&user)?;
    if get_doc(&mongo, uid, &id).await?.is_none() {
        return Err(ApiError::NotFound(format!("No customer \"{id}\".")));
    }
    let cursor = mongo
        .collection::<Document>(store::PAYMENTS)
        .find(doc! { "userId": uid, "customerId": &id })
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.payments")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.customer.payments.collect")))?;
    let payments: Vec<_> = docs.iter().map(doc_to_payment).collect();
    Ok(Json(serde_json::json!({ "payments": payments })))
}
