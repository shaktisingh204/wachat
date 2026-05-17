use axum::{
    Json,
    extract::{Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;

use crate::{
    dto::{ByKeyList, LogPage, LogsQuery, Summary, TopList, TopQuery, WindowQuery},
    store,
};

pub async fn summary(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<WindowQuery>,
) -> Result<Json<Summary>> {
    let s = store::summary(&mongo, &user.user_id, q.from.as_deref(), q.to.as_deref()).await?;
    Ok(Json(s))
}

pub async fn top(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<TopQuery>,
) -> Result<Json<TopList>> {
    let data = store::top(&mongo, &user.user_id, q.from.as_deref(), q.to.as_deref(), q.limit)
        .await?;
    Ok(Json(TopList { data }))
}

pub async fn by_key(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<WindowQuery>,
) -> Result<Json<ByKeyList>> {
    let data = store::by_key(&mongo, &user.user_id, q.from.as_deref(), q.to.as_deref()).await?;
    Ok(Json(ByKeyList { data }))
}

pub async fn logs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<LogsQuery>,
) -> Result<Json<LogPage>> {
    let r = store::logs(
        &mongo,
        &user.user_id,
        q.from.as_deref(),
        q.to.as_deref(),
        q.key_id.as_deref(),
        q.path.as_deref(),
        q.min_status,
        q.cursor.as_deref(),
        q.limit,
    )
    .await?;
    Ok(Json(LogPage {
        data: r.rows,
        next_cursor: r.next_cursor,
    }))
}
