//! Per-subscriber rendering for the send pipeline.
//!
//! The output is a `(subject, html)` pair ready to hand to a provider
//! adapter. Inputs are:
//!
//!   * the campaign doc (subject template, body template, tracking knobs)
//!   * the subscriber doc (first/last name, email, custom fields)
//!   * the brand kit (footer / unsubscribe block injection)
//!
//! Substitution mirrors the preview path in `email-campaigns`: only
//! snake-case `{{ tag }}` placeholders are honoured; unknown tags
//! collapse to the empty string. The renderer never panics — invalid
//! merge tags were rejected at pre-flight time.

use bson::Document;
use email_types::EmailBrandKit;
use regex::Regex;

use crate::tracking;

/// Output of [`render_for_subscriber`].
pub struct RenderOutput {
    pub subject: String,
    pub html: String,
}

/// Render the campaign for one subscriber.
///
/// Required inputs are passed as `bson::Document` (rather than typed
/// `EmailCampaign` / `EmailSubscriber`) because the worker reads the raw
/// docs to avoid an extra deserialisation hop on the hot path. The
/// brand kit is optional — when present, its footer block is appended;
/// when absent, the rendered body is used verbatim.
pub fn render_for_subscriber(
    campaign: &Document,
    subscriber: &Document,
    brand_kit: Option<&EmailBrandKit>,
    base_url: &str,
    tracking_secret: &[u8],
    now_unix_s: i64,
) -> RenderOutput {
    let raw_subject = campaign.get_str("subject").unwrap_or("");
    let raw_body = campaign.get_str("body").unwrap_or("");

    let campaign_id = campaign
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let subscriber_id = subscriber.get_object_id("_id").map(|o| o.to_hex()).ok();
    let subscriber_id_ref = subscriber_id.as_deref();

    // Build the merge-tag table once and reuse for subject + body.
    let ctx = MergeContext::from_subscriber(
        subscriber,
        &campaign_id,
        subscriber_id_ref,
        base_url,
        tracking_secret,
        now_unix_s,
    );

    let subject = interpolate(raw_subject, &ctx);
    let mut html = interpolate(raw_body, &ctx);

    // Brand-kit footer injection — keep simple: append a `<div>` with
    // the company name + unsubscribe link. The full builder integration
    // (logo, social icons, etc.) lives in `email-templates`.
    if let Some(bk) = brand_kit {
        html.push_str(&render_footer(bk, &ctx.unsubscribe_url));
    }

    // Tracking injection (opens + click-wrap). Skipped when the campaign
    // turned the respective knob off — defaults are on.
    let track_opens = campaign.get_bool("trackOpens").unwrap_or(true);
    let track_clicks = campaign.get_bool("trackClicks").unwrap_or(true);

    if track_clicks {
        html = rewrite_links(
            &html,
            &campaign_id,
            subscriber_id_ref,
            base_url,
            tracking_secret,
            now_unix_s,
        );
    }
    if track_opens {
        let pixel = tracking::open_pixel_url(
            base_url,
            tracking_secret,
            &campaign_id,
            subscriber_id_ref,
            now_unix_s,
        );
        html.push_str(&format!(
            r#"<img src="{pixel}" width="1" height="1" alt="" style="display:none" />"#
        ));
    }

    RenderOutput { subject, html }
}

// ---------------------------------------------------------------------------
// Merge tag substitution
// ---------------------------------------------------------------------------

struct MergeContext {
    email: String,
    first_name: String,
    last_name: String,
    unsubscribe_url: String,
    /// Custom fields snapshot for `{{ custom_<key> }}` lookups.
    custom: Document,
}

impl MergeContext {
    fn from_subscriber(
        sub: &Document,
        campaign_id: &str,
        subscriber_id: Option<&str>,
        base_url: &str,
        tracking_secret: &[u8],
        now_unix_s: i64,
    ) -> Self {
        // Unsubscribe URL is a click-wrapped link to the public
        // unsubscribe endpoint. We reuse the click-tracking wrapper so
        // unsubscribes are also recorded as events.
        let unsub_target = format!(
            "{}/p/unsubscribe?c={campaign_id}",
            base_url.trim_end_matches('/')
        );
        let unsubscribe_url = tracking::click_wrap_url(
            base_url,
            tracking_secret,
            campaign_id,
            subscriber_id,
            now_unix_s,
            &unsub_target,
        );
        Self {
            email: sub.get_str("email").unwrap_or("").to_owned(),
            first_name: sub.get_str("firstName").unwrap_or("").to_owned(),
            last_name: sub.get_str("lastName").unwrap_or("").to_owned(),
            unsubscribe_url,
            custom: sub
                .get_document("customFields")
                .cloned()
                .unwrap_or_default(),
        }
    }

    fn lookup(&self, tag: &str) -> Option<String> {
        match tag {
            "email" => Some(self.email.clone()),
            "first_name" | "firstName" => Some(self.first_name.clone()),
            "last_name" | "lastName" => Some(self.last_name.clone()),
            "unsubscribe_url" | "unsubscribeUrl" => Some(self.unsubscribe_url.clone()),
            other => {
                // `{{ custom_<key> }}` reaches into the customFields blob.
                if let Some(key) = other.strip_prefix("custom_") {
                    self.custom.get(key).and_then(|v| match v {
                        bson::Bson::String(s) => Some(s.clone()),
                        bson::Bson::Int32(i) => Some(i.to_string()),
                        bson::Bson::Int64(i) => Some(i.to_string()),
                        bson::Bson::Double(f) => Some(f.to_string()),
                        bson::Bson::Boolean(b) => Some(b.to_string()),
                        _ => None,
                    })
                } else {
                    None
                }
            }
        }
    }
}

fn interpolate(template: &str, ctx: &MergeContext) -> String {
    let re = Regex::new(r"\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}").expect("merge-tag regex");
    re.replace_all(template, |caps: &regex::Captures<'_>| {
        let tag = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        ctx.lookup(tag).unwrap_or_default()
    })
    .into_owned()
}

// ---------------------------------------------------------------------------
// Link rewriting
// ---------------------------------------------------------------------------

/// Rewrite every `href="https?://..."` to a click-wrap URL. Conservative
/// — anchors, mailto:, and tel: links pass through unchanged.
fn rewrite_links(
    html: &str,
    campaign_id: &str,
    subscriber_id: Option<&str>,
    base_url: &str,
    secret: &[u8],
    now_unix_s: i64,
) -> String {
    // We only rewrite `href="..."` (double-quoted) — the simpler shape
    // catches every Mailchimp-emitted link without dragging in a full
    // HTML parser. Single-quoted hrefs survive verbatim; templates that
    // emit single-quoted attrs (rare) will simply not be click-tracked.
    let re = Regex::new(r#"href="(https?://[^"]+)""#).expect("href regex");
    re.replace_all(html, |caps: &regex::Captures<'_>| {
        let target = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let wrapped = tracking::click_wrap_url(
            base_url,
            secret,
            campaign_id,
            subscriber_id,
            now_unix_s,
            target,
        );
        format!(r#"href="{wrapped}""#)
    })
    .into_owned()
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

fn render_footer(bk: &EmailBrandKit, unsubscribe_url: &str) -> String {
    format!(
        r#"<div style="font-size:12px;color:#999;margin-top:24px;text-align:center">
<div>{company}</div>
<div>{address}</div>
<div><a href="{unsub}">Unsubscribe</a></div>
</div>"#,
        company = html_escape(&bk.footer.company_name),
        address = html_escape(&bk.footer.address),
        unsub = unsubscribe_url
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    fn mk_subscriber() -> Document {
        doc! {
            "email": "u@x.test",
            "firstName": "Ada",
            "lastName": "Lovelace",
            "customFields": { "tier": "gold" },
        }
    }

    fn mk_campaign() -> Document {
        doc! {
            "_id": bson::oid::ObjectId::new(),
            "subject": "Hi {{ first_name }}!",
            "body": "<p>Hi {{ first_name }} ({{ email }}), tier {{ custom_tier }}.</p>",
            "trackOpens": true,
            "trackClicks": true,
        }
    }

    #[test]
    fn renders_subject_and_body() {
        let out = render_for_subscriber(
            &mk_campaign(),
            &mk_subscriber(),
            None,
            "https://x.test",
            b"k",
            0,
        );
        assert_eq!(out.subject, "Hi Ada!");
        assert!(out.html.contains("Hi Ada (u@x.test), tier gold."));
        // Tracking pixel was injected.
        assert!(out.html.contains("/v1/email/events/open?token="));
    }

    #[test]
    fn rewrites_links() {
        let c = doc! {
            "_id": bson::oid::ObjectId::new(),
            "subject": "s",
            "body": r#"<a href="https://t.test/x?y=1">go</a>"#,
            "trackOpens": false,
            "trackClicks": true,
        };
        let out = render_for_subscriber(&c, &mk_subscriber(), None, "https://x.test", b"k", 0);
        assert!(out.html.contains("/v1/email/events/click?token="));
        assert!(!out.html.contains("https://t.test/x?y=1\""));
    }

    #[test]
    fn skips_tracking_when_disabled() {
        let c = doc! {
            "_id": bson::oid::ObjectId::new(),
            "subject": "s",
            "body": r#"<a href="https://t.test">go</a>"#,
            "trackOpens": false,
            "trackClicks": false,
        };
        let out = render_for_subscriber(&c, &mk_subscriber(), None, "https://x.test", b"k", 0);
        assert!(out.html.contains(r#"href="https://t.test""#));
        assert!(!out.html.contains("/v1/email/events/open"));
    }
}
