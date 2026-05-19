//! Prebuilt journey template catalogue.
//!
//! Seeded in code so the catalogue is deployable without a Mongo seed
//! step. Returned by `GET /templates`. Each template is a minimal
//! `{ id, name, description, triggerKind, nodes, edges }` shape — the
//! UI hydrates this into a working draft via a `POST /` follow-up.

use serde_json::{Value, json};

/// Return the prebuilt-template catalogue.
///
/// Six baseline templates: welcome, abandoned-cart, re-engagement,
/// birthday, trial-nudge, post-purchase. The exact node shapes are
/// stubs — the UI fills in the email templateIds and timings before
/// the user activates the journey.
pub fn library() -> Vec<Value> {
    vec![
        welcome(),
        abandoned_cart(),
        reengagement(),
        birthday(),
        trial_nudge(),
        post_purchase(),
    ]
}

fn welcome() -> Value {
    json!({
        "id": "welcome",
        "name": "Welcome series",
        "description": "Greet new subscribers with a 3-email onboarding series triggered on list join.",
        "triggerKind": "list_join",
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "position": { "x": 0.0, "y": 0.0 },
                "data": { "label": "List join" }
            },
            {
                "id": "email_1",
                "type": "email",
                "position": { "x": 0.0, "y": 120.0 },
                "data": { "label": "Welcome email" }
            },
            {
                "id": "wait_1",
                "type": "wait",
                "position": { "x": 0.0, "y": 240.0 },
                "data": { "label": "Wait 2 days", "waitFor": { "value": 2, "unit": "days" } }
            },
            {
                "id": "email_2",
                "type": "email",
                "position": { "x": 0.0, "y": 360.0 },
                "data": { "label": "Getting started" }
            },
            {
                "id": "wait_2",
                "type": "wait",
                "position": { "x": 0.0, "y": 480.0 },
                "data": { "label": "Wait 3 days", "waitFor": { "value": 3, "unit": "days" } }
            },
            {
                "id": "email_3",
                "type": "email",
                "position": { "x": 0.0, "y": 600.0 },
                "data": { "label": "Pro tips" }
            },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 720.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "email_1" },
            { "id": "e2", "source": "email_1", "target": "wait_1" },
            { "id": "e3", "source": "wait_1", "target": "email_2" },
            { "id": "e4", "source": "email_2", "target": "wait_2" },
            { "id": "e5", "source": "wait_2", "target": "email_3" },
            { "id": "e6", "source": "email_3", "target": "exit" }
        ]
    })
}

fn abandoned_cart() -> Value {
    json!({
        "id": "abandoned-cart",
        "name": "Abandoned cart",
        "description": "Recover lost sales — wait 1h after a cart-abandoned event, then email a reminder.",
        "triggerKind": "tag_added",
        "nodes": [
            { "id": "trigger", "type": "trigger", "position": { "x": 0.0, "y": 0.0 }, "data": { "label": "Tag: cart-abandoned" } },
            { "id": "wait_1", "type": "wait", "position": { "x": 0.0, "y": 120.0 }, "data": { "label": "Wait 1 hour", "waitFor": { "value": 1, "unit": "hours" } } },
            { "id": "email_1", "type": "email", "position": { "x": 0.0, "y": 240.0 }, "data": { "label": "Reminder email" } },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 360.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "wait_1" },
            { "id": "e2", "source": "wait_1", "target": "email_1" },
            { "id": "e3", "source": "email_1", "target": "exit" }
        ]
    })
}

fn reengagement() -> Value {
    json!({
        "id": "re-engagement",
        "name": "Re-engagement",
        "description": "Win back inactive subscribers (no opens in 90 days). Sends a comeback email and unsubscribes if still silent.",
        "triggerKind": "segment_enter",
        "nodes": [
            { "id": "trigger", "type": "trigger", "position": { "x": 0.0, "y": 0.0 }, "data": { "label": "Segment: inactive 90d" } },
            { "id": "email_1", "type": "email", "position": { "x": 0.0, "y": 120.0 }, "data": { "label": "We miss you" } },
            { "id": "wait_1", "type": "wait", "position": { "x": 0.0, "y": 240.0 }, "data": { "label": "Wait 14 days", "waitFor": { "value": 14, "unit": "days" } } },
            { "id": "action_1", "type": "action", "position": { "x": 0.0, "y": 360.0 }, "data": { "label": "Unsubscribe", "action": { "kind": "unsubscribe", "config": {} } } },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 480.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "email_1" },
            { "id": "e2", "source": "email_1", "target": "wait_1" },
            { "id": "e3", "source": "wait_1", "target": "action_1" },
            { "id": "e4", "source": "action_1", "target": "exit" }
        ]
    })
}

fn birthday() -> Value {
    json!({
        "id": "birthday",
        "name": "Birthday wish",
        "description": "Annual date-anniversary trigger — sends a birthday email with a coupon.",
        "triggerKind": "date_anniversary",
        "nodes": [
            { "id": "trigger", "type": "trigger", "position": { "x": 0.0, "y": 0.0 }, "data": { "label": "Birthday" } },
            { "id": "email_1", "type": "email", "position": { "x": 0.0, "y": 120.0 }, "data": { "label": "Happy birthday!" } },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 240.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "email_1" },
            { "id": "e2", "source": "email_1", "target": "exit" }
        ]
    })
}

fn trial_nudge() -> Value {
    json!({
        "id": "trial-nudge",
        "name": "Trial nudge",
        "description": "Convert trial users — split tests two CTA variants on day 5.",
        "triggerKind": "tag_added",
        "nodes": [
            { "id": "trigger", "type": "trigger", "position": { "x": 0.0, "y": 0.0 }, "data": { "label": "Tag: trial-started" } },
            { "id": "wait_1", "type": "wait", "position": { "x": 0.0, "y": 120.0 }, "data": { "label": "Wait 5 days", "waitFor": { "value": 5, "unit": "days" } } },
            { "id": "split", "type": "split", "position": { "x": 0.0, "y": 240.0 }, "data": { "label": "A/B 50/50", "splitWeights": [50, 50] } },
            { "id": "email_a", "type": "email", "position": { "x": -120.0, "y": 360.0 }, "data": { "label": "CTA A" } },
            { "id": "email_b", "type": "email", "position": { "x": 120.0, "y": 360.0 }, "data": { "label": "CTA B" } },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 480.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "wait_1" },
            { "id": "e2", "source": "wait_1", "target": "split" },
            { "id": "e3", "source": "split", "target": "email_a" },
            { "id": "e4", "source": "split", "target": "email_b" },
            { "id": "e5", "source": "email_a", "target": "exit" },
            { "id": "e6", "source": "email_b", "target": "exit" }
        ]
    })
}

fn post_purchase() -> Value {
    json!({
        "id": "post-purchase",
        "name": "Post purchase",
        "description": "Thank-you email immediately after purchase, follow-up review request after 7 days.",
        "triggerKind": "tag_added",
        "nodes": [
            { "id": "trigger", "type": "trigger", "position": { "x": 0.0, "y": 0.0 }, "data": { "label": "Tag: purchased" } },
            { "id": "email_1", "type": "email", "position": { "x": 0.0, "y": 120.0 }, "data": { "label": "Thank you" } },
            { "id": "wait_1", "type": "wait", "position": { "x": 0.0, "y": 240.0 }, "data": { "label": "Wait 7 days", "waitFor": { "value": 7, "unit": "days" } } },
            { "id": "email_2", "type": "email", "position": { "x": 0.0, "y": 360.0 }, "data": { "label": "Review request" } },
            { "id": "exit", "type": "exit", "position": { "x": 0.0, "y": 480.0 }, "data": {} }
        ],
        "edges": [
            { "id": "e1", "source": "trigger", "target": "email_1" },
            { "id": "e2", "source": "email_1", "target": "wait_1" },
            { "id": "e3", "source": "wait_1", "target": "email_2" },
            { "id": "e4", "source": "email_2", "target": "exit" }
        ]
    })
}
