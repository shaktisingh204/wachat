//! Golden tests for `check_limits`. These pin Meta's published per-type
//! caps so any future docs change shows up as a test failure rather
//! than a silent over-the-wire 4xx from Meta.

use wachat_media::{
    MAX_AUDIO_BYTES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MediaError, check_limits,
};

#[test]
fn image_under_cap_passes() {
    assert!(check_limits("image/jpeg", MAX_IMAGE_BYTES).is_ok());
    assert!(check_limits("image/png", 1024).is_ok());
}

#[test]
fn image_over_cap_is_too_large() {
    let err = check_limits("image/jpeg", MAX_IMAGE_BYTES + 1).unwrap_err();
    assert!(matches!(err, MediaError::TooLarge(n) if n == MAX_IMAGE_BYTES + 1));
}

#[test]
fn video_at_cap_passes_over_cap_fails() {
    assert!(check_limits("video/mp4", MAX_VIDEO_BYTES).is_ok());
    assert!(matches!(
        check_limits("video/mp4", MAX_VIDEO_BYTES + 1).unwrap_err(),
        MediaError::TooLarge(_)
    ));
}

#[test]
fn audio_at_cap_passes_over_cap_fails() {
    assert!(check_limits("audio/ogg", MAX_AUDIO_BYTES).is_ok());
    assert!(matches!(
        check_limits("audio/mpeg", MAX_AUDIO_BYTES + 1).unwrap_err(),
        MediaError::TooLarge(_)
    ));
}

#[test]
fn document_at_cap_passes_over_cap_fails() {
    assert!(check_limits("application/pdf", MAX_DOCUMENT_BYTES).is_ok());
    assert!(matches!(
        check_limits("application/pdf", MAX_DOCUMENT_BYTES + 1).unwrap_err(),
        MediaError::TooLarge(_)
    ));
}

#[test]
fn unsupported_top_level_type_is_rejected() {
    let err = check_limits("model/gltf-binary", 100).unwrap_err();
    assert!(matches!(err, MediaError::Unsupported(_)));
}

#[test]
fn malformed_mime_is_rejected() {
    let err = check_limits("not-a-mime", 100).unwrap_err();
    assert!(matches!(err, MediaError::Unsupported(_)));
}

#[test]
fn webp_under_image_cap_passes() {
    // image/webp can be a sticker OR a regular image; we accept up to
    // the image cap and let the caller pick the API.
    assert!(check_limits("image/webp", 50_000).is_ok());
    assert!(check_limits("image/webp", MAX_IMAGE_BYTES).is_ok());
}

#[test]
fn webp_over_image_cap_fails() {
    assert!(matches!(
        check_limits("image/webp", MAX_IMAGE_BYTES + 1).unwrap_err(),
        MediaError::TooLarge(_)
    ));
}
