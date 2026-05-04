//! End-to-end-ish test of the single-shot media upload happy path,
//! using `wiremock` to stand in for `graph.facebook.com`.

use bytes::Bytes;
use wachat_media::{MediaId, MediaUploader};
use wiremock::matchers::{header_exists, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn upload_for_messages_returns_media_id() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/v20.0/PNID123/media"))
        .and(header_exists("authorization"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "id": "abc"
        })))
        .mount(&server)
        .await;

    let uploader = MediaUploader::new_with_base(server.uri(), "v20.0");
    let bytes = Bytes::from_static(&[0u8, 1, 2, 3, 4]);

    let media_id = uploader
        .upload_for_messages("PNID123", "fake-token", bytes, "image/png", "test.png")
        .await
        .expect("upload should succeed");

    assert_eq!(media_id, MediaId("abc".to_owned()));
}

#[tokio::test]
async fn upload_for_messages_surfaces_meta_error() {
    let server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/v20.0/PNID123/media"))
        .respond_with(ResponseTemplate::new(400).set_body_json(serde_json::json!({
            "error": {
                "message": "bad media type",
                "code": 100
            }
        })))
        .mount(&server)
        .await;

    let uploader = MediaUploader::new_with_base(server.uri(), "v20.0");
    let bytes = Bytes::from_static(&[0u8; 16]);

    let err = uploader
        .upload_for_messages("PNID123", "fake-token", bytes, "image/png", "test.png")
        .await
        .expect_err("should surface 400 as MetaApi error");

    match err {
        wachat_media::MediaError::MetaApi {
            status,
            message,
            code,
        } => {
            assert_eq!(status, 400);
            assert_eq!(message, "bad media type");
            assert_eq!(code, Some(100));
        }
        other => panic!("expected MetaApi error, got {other:?}"),
    }
}
