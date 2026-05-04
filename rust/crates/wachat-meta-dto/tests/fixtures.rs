//! Fixture-based round-trip + deserialisation tests.
//!
//! Each fixture mirrors a payload SabNode actually produces or receives in
//! `whatsapp.actions.ts`, `send-template.actions.ts`, `template.actions.ts`,
//! or `api/webhooks/meta/route.ts`. We assert the load-bearing fields rather
//! than full equality so adding new optional Meta keys upstream doesn't
//! break the suite.

use serde_json::json;
use wachat_meta_dto::{
    CreateTemplateReq, ListTemplatesResp, MediaUploadResp, MediaUrlResp, MetaApiErrorEnvelope,
    SendEnvelope, SendMessage, SendResponse, TemplateBody, TemplateLanguage, WebhookEvent,
};

#[test]
fn deserialises_send_text_request_shape() {
    // Mirrors whatsapp.actions.ts line ~1100:
    //   messagePayload.type = 'text'; messagePayload.text = { body, preview_url: true };
    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919876543210",
        "type": "text",
        "text": { "body": "hello", "preview_url": true }
    });

    let env: SendEnvelope = serde_json::from_value(payload).unwrap();
    assert_eq!(env.messaging_product, "whatsapp");
    assert_eq!(env.recipient_type.as_deref(), Some("individual"));
    match env.message {
        SendMessage::Text { to, text, .. } => {
            assert_eq!(to, "919876543210");
            assert_eq!(text.body, "hello");
            assert!(text.preview_url);
        }
        _ => panic!("expected Text variant"),
    }
}

#[test]
fn round_trips_send_template_request() {
    // Mirrors send-template.actions.ts line ~308:
    //   { messaging_product: "whatsapp", to, type: "template",
    //     template: { name, language: { code }, components: [...] } }
    let original = SendEnvelope::new(SendMessage::Template {
        to: "919876543210".into(),
        template: TemplateBody {
            name: "order_confirmation".into(),
            language: TemplateLanguage {
                code: "en_US".into(),
            },
            components: vec![json!({
                "type": "body",
                "parameters": [{ "type": "text", "text": "Alice" }]
            })],
        },
    });

    let serialized = serde_json::to_value(&original).unwrap();
    assert_eq!(serialized["messaging_product"], "whatsapp");
    assert_eq!(serialized["type"], "template");
    assert_eq!(serialized["template"]["name"], "order_confirmation");
    assert_eq!(serialized["template"]["language"]["code"], "en_US");

    let round_tripped: SendEnvelope = serde_json::from_value(serialized).unwrap();
    match round_tripped.message {
        SendMessage::Template { to, template } => {
            assert_eq!(to, "919876543210");
            assert_eq!(template.name, "order_confirmation");
            assert_eq!(template.language.code, "en_US");
            assert_eq!(template.components.len(), 1);
        }
        _ => panic!("expected Template variant"),
    }
}

#[test]
fn deserialises_send_image_with_media_id() {
    // Mirrors whatsapp.actions.ts line ~450:
    //   messagePayload.image = { id: mediaId }; (+ optional caption)
    let payload = json!({
        "messaging_product": "whatsapp",
        "to": "919876543210",
        "type": "image",
        "image": { "id": "1234567890", "caption": "look!" }
    });

    let env: SendEnvelope = serde_json::from_value(payload).unwrap();
    match env.message {
        SendMessage::Image { to, image } => {
            assert_eq!(to, "919876543210");
            assert_eq!(image.id.as_deref(), Some("1234567890"));
            assert_eq!(image.caption.as_deref(), Some("look!"));
            assert!(image.link.is_none());
        }
        _ => panic!("expected Image variant"),
    }
}

#[test]
fn deserialises_send_response_and_extracts_wamid() {
    // Mirrors whatsapp.actions.ts:
    //   const wamid = response.data?.messages?.[0]?.id;
    let payload = json!({
        "messaging_product": "whatsapp",
        "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
        "messages": [{ "id": "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSMTIzNDU2Nzg5QUJDREVGAA==" }]
    });

    let resp: SendResponse = serde_json::from_value(payload).unwrap();
    assert_eq!(resp.messaging_product, "whatsapp");
    assert_eq!(resp.contacts[0].wa_id, "919876543210");
    assert!(resp.messages[0].id.starts_with("wamid."));
}

#[test]
fn deserialises_create_template_request_shape() {
    // Mirrors template.actions.ts: POST /{wabaId}/message_templates body.
    let req = CreateTemplateReq {
        name: "welcome_v2".into(),
        language: "en_US".into(),
        category: "MARKETING".into(),
        components: vec![json!({ "type": "BODY", "text": "Hi {{1}}!" })],
    };
    let json = serde_json::to_value(&req).unwrap();
    assert_eq!(json["name"], "welcome_v2");
    assert_eq!(json["language"], "en_US");
    assert_eq!(json["category"], "MARKETING");
    assert_eq!(json["components"][0]["type"], "BODY");
}

#[test]
fn deserialises_list_templates_response() {
    // Mirrors template.actions.ts list call response.
    let payload = json!({
        "data": [{
            "id": "111111111",
            "name": "welcome_v2",
            "language": "en_US",
            "status": "APPROVED",
            "category": "MARKETING",
            "components": [{ "type": "BODY", "text": "Hi {{1}}!" }],
            "quality_score": { "score": "GREEN" }
        }],
        "paging": {
            "cursors": { "before": "abc", "after": "def" },
            "next": "https://graph.facebook.com/v23.0/.../message_templates?after=def"
        }
    });

    let resp: ListTemplatesResp = serde_json::from_value(payload).unwrap();
    assert_eq!(resp.data.len(), 1);
    let t = &resp.data[0];
    assert_eq!(t.name, "welcome_v2");
    assert_eq!(t.status, "APPROVED");
    assert_eq!(t.category, "MARKETING");
    assert!(t.quality_score.is_some());
    let paging = resp.paging.unwrap();
    assert_eq!(paging.cursors.unwrap().after.as_deref(), Some("def"));
    assert!(paging.next.unwrap().contains("after=def"));
}

#[test]
fn deserialises_inbound_text_webhook() {
    // Mirrors api/webhooks/meta/route.ts top-level payload + inbound message.
    let payload = json!({
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "1234567890",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "display_phone_number": "15551234567",
                        "phone_number_id": "9876543210"
                    },
                    "contacts": [{
                        "profile": { "name": "Alice" },
                        "wa_id": "919876543210"
                    }],
                    "messages": [{
                        "from": "919876543210",
                        "id": "wamid.ABC",
                        "timestamp": "1717000000",
                        "type": "text",
                        "text": { "body": "hello" }
                    }]
                }
            }]
        }]
    });

    let evt: WebhookEvent = serde_json::from_value(payload).unwrap();
    assert_eq!(evt.object, "whatsapp_business_account");
    let change = &evt.entry[0].changes[0];
    assert_eq!(change.field, "messages");
    let value = &change.value;
    assert_eq!(
        value.metadata.as_ref().unwrap().phone_number_id,
        "9876543210"
    );
    let msg = &value.messages.as_ref().unwrap()[0];
    assert_eq!(msg.from, "919876543210");
    assert_eq!(msg.r#type, "text");
    assert_eq!(msg.text.as_ref().unwrap().body, "hello");
    assert_eq!(msg.timestamp, "1717000000");
    let contact = &value.contacts.as_ref().unwrap()[0];
    assert_eq!(contact.wa_id, "919876543210");
    assert_eq!(contact.profile.name.as_deref(), Some("Alice"));
}

#[test]
fn deserialises_status_update_webhook() {
    // Mirrors webhook-processor.ts: change.value.statuses[*]
    let payload = json!({
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "1234567890",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "display_phone_number": "15551234567",
                        "phone_number_id": "9876543210"
                    },
                    "statuses": [{
                        "id": "wamid.ABC",
                        "status": "delivered",
                        "timestamp": "1717000050",
                        "recipient_id": "919876543210",
                        "conversation": { "id": "conv-1", "origin": { "type": "service" } },
                        "pricing": { "billable": true, "pricing_model": "CBP", "category": "service" }
                    }]
                }
            }]
        }]
    });

    let evt: WebhookEvent = serde_json::from_value(payload).unwrap();
    let status = &evt.entry[0].changes[0].value.statuses.as_ref().unwrap()[0];
    assert_eq!(status.id, "wamid.ABC");
    assert_eq!(status.status, "delivered");
    assert_eq!(status.recipient_id, "919876543210");
    assert!(status.conversation.is_some());
    assert!(status.pricing.is_some());
}

#[test]
fn deserialises_meta_api_error_envelope() {
    let payload = json!({
        "error": {
            "message": "(#100) Invalid parameter",
            "type": "OAuthException",
            "code": 100,
            "error_subcode": 2018278,
            "fbtrace_id": "AbCdEfGhIjK",
            "error_data": { "messaging_product": "whatsapp", "details": "Recipient not opted in" }
        }
    });

    let env: MetaApiErrorEnvelope = serde_json::from_value(payload).unwrap();
    assert_eq!(env.error.message, "(#100) Invalid parameter");
    assert_eq!(env.error.code, Some(100));
    assert_eq!(env.error.error_subcode, Some(2018278));
    assert_eq!(env.error.r#type.as_deref(), Some("OAuthException"));
    assert_eq!(env.error.fbtrace_id.as_deref(), Some("AbCdEfGhIjK"));
    assert!(env.error.error_data.is_some());
}

#[test]
fn deserialises_media_upload_and_url_responses() {
    let upload: MediaUploadResp = serde_json::from_value(json!({ "id": "1234567890" })).unwrap();
    assert_eq!(upload.id, "1234567890");

    let url: MediaUrlResp = serde_json::from_value(json!({
        "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=ABC&ext=...",
        "mime_type": "image/jpeg",
        "sha256": "deadbeef",
        "file_size": 12345_u64,
        "id": "1234567890",
        "messaging_product": "whatsapp"
    }))
    .unwrap();
    assert_eq!(url.mime_type, "image/jpeg");
    assert_eq!(url.file_size, 12345);
    assert_eq!(url.messaging_product, "whatsapp");
}
