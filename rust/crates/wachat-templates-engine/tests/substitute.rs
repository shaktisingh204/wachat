//! Golden tests for the substitution engine.
//!
//! These pin the wire-level behaviour we promised in the slice spec —
//! positional, named, mixed, missing var, empty value, escaping, Unicode,
//! and a 2-button Meta `components` shape.

use serde_json::json;

use wachat_templates_engine::{
    Placeholder, SubstituteError, TemplateButton, TemplateSpec, Variables, build_components,
    extract_placeholders, substitute,
};

#[test]
fn positional_substitution() {
    let vars = Variables::new()
        .set_positional(1, "Alice")
        .set_positional(2, "ORDER-42");

    let out = substitute("Hi {{1}}, your order {{2}} is on the way.", &vars).unwrap();
    assert_eq!(out, "Hi Alice, your order ORDER-42 is on the way.");
}

#[test]
fn named_substitution() {
    let vars = Variables::new().with_named([("first_name", "Bob"), ("city", "Berlin")]);

    let out = substitute("Hello {{first_name}} from {{city}}!", &vars).unwrap();
    assert_eq!(out, "Hello Bob from Berlin!");
}

#[test]
fn mixed_positional_and_named() {
    let vars = Variables::new()
        .set_positional(1, "Carol")
        .with_named([("ticket", "T-99")]);

    let out = substitute("Dear {{1}}, ticket {{ticket}} updated.", &vars).unwrap();
    assert_eq!(out, "Dear Carol, ticket T-99 updated.");
}

#[test]
fn missing_positional_returns_error() {
    let vars = Variables::new().set_positional(1, "Dan");
    let err = substitute("Hi {{1}} ref {{2}}", &vars).unwrap_err();
    assert_eq!(err, SubstituteError::MissingPositional(2));
}

#[test]
fn missing_named_returns_error() {
    let vars = Variables::new().with_named([("a", "1")]);
    let err = substitute("Hi {{b}}", &vars).unwrap_err();
    assert_eq!(err, SubstituteError::MissingNamed("b".to_owned()));
}

#[test]
fn empty_value_is_an_error_not_a_silent_fallback() {
    // The TS code substitutes a U+200B zero-width space here. We refuse
    // and let the caller mark the contact as a permanent failure.
    let vars = Variables::new().set_positional(1, "");
    let err = substitute("Hi {{1}}", &vars).unwrap_err();
    assert_eq!(
        err,
        SubstituteError::EmptyValue {
            placeholder: "1".to_owned()
        }
    );
}

#[test]
fn single_brace_passes_through_unchanged() {
    // A literal `{` not followed by another `{` must NOT be touched —
    // matches both the regex and Meta's grammar.
    let vars = Variables::new().set_positional(1, "X");
    let out = substitute("price = { 1 } and {{1}} units, json: {\"k\": 1}", &vars).unwrap();
    assert_eq!(out, "price = { 1 } and X units, json: {\"k\": 1}");
}

#[test]
fn unicode_values_are_preserved_byte_for_byte() {
    let vars = Variables::new()
        .set_positional(1, "नमस्ते")
        .with_named([("emoji", "🎉🚀")]);
    let out = substitute("Hi {{1}} {{emoji}}", &vars).unwrap();
    assert_eq!(out, "Hi नमस्ते 🎉🚀");
}

#[test]
fn extract_placeholders_orders_and_dedupes() {
    let p = extract_placeholders("{{2}} {{name}} {{1}} {{2}} {{name}}");
    assert_eq!(
        p,
        vec![
            Placeholder::Positional(2),
            Placeholder::Named("name".into()),
            Placeholder::Positional(1),
        ]
    );
}

#[test]
fn build_components_for_two_button_template_matches_meta_shape() {
    let template = TemplateSpec {
        name: "order_confirmation".into(),
        language_code: "en_US".into(),
        header: Some("Hello {{1}}".into()),
        body: "Your order {{2}} for {{1}} ships {{3}}.".into(),
        footer: Some("Thanks for shopping with us!".into()),
        buttons: vec![
            TemplateButton::QuickReply {
                text: "Track order".into(),
            },
            TemplateButton::Url {
                text: "View order".into(),
                url_template: "https://example.com/orders/{{1}}".into(),
            },
        ],
    };

    let vars = Variables::new()
        .set_positional(1, "Eve")
        .set_positional(2, "ORD-7")
        .set_positional(3, "tomorrow");

    let components = build_components(&template, &vars).expect("build_components");

    let actual = serde_json::to_value(&components).unwrap();
    // Header (1 param) + body (3 params, sorted by position) + url button at index 1.
    let expected = json!([
        {
            "type": "header",
            "parameters": [
                { "type": "text", "text": "Eve" }
            ]
        },
        {
            "type": "body",
            "parameters": [
                { "type": "text", "text": "Eve" },
                { "type": "text", "text": "ORD-7" },
                { "type": "text", "text": "tomorrow" }
            ]
        },
        {
            "type": "button",
            "sub_type": "url",
            "index": "1",
            "parameters": [
                { "type": "text", "text": "Eve" }
            ]
        }
    ]);

    assert_eq!(actual, expected);
}

#[test]
fn build_components_skips_static_buttons_and_static_text_header() {
    // Header text without placeholders is omitted (Meta uses the template
    // definition); QuickReply buttons never carry runtime params.
    let template = TemplateSpec {
        name: "static".into(),
        language_code: "en".into(),
        header: Some("Welcome!".into()),
        body: "Hi {{1}}".into(),
        footer: None,
        buttons: vec![TemplateButton::QuickReply { text: "OK".into() }],
    };

    let vars = Variables::new().set_positional(1, "Frank");
    let components = build_components(&template, &vars).unwrap();

    let actual = serde_json::to_value(&components).unwrap();
    let expected = json!([
        {
            "type": "body",
            "parameters": [{ "type": "text", "text": "Frank" }]
        }
    ]);
    assert_eq!(actual, expected);
}

#[test]
fn variables_merge_lets_per_recipient_win_over_global() {
    // Mirrors the TS pattern in send-message.js:
    //   { ...globalBodyVars, ...contact.variables }
    // where contact-level vars override broadcast-level globals.
    let global = Variables::new().set_positional(1, "GLOBAL");
    let per_contact = Variables::new().set_positional(1, "CONTACT");

    let merged = global.merge(per_contact);
    let out = substitute("{{1}}", &merged).unwrap();
    assert_eq!(out, "CONTACT");
}
