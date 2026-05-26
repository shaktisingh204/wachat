use handlebars::Handlebars;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Encoding {
    Gsm7,
    Ucs2,
}

#[derive(Debug, Clone)]
pub struct SmsInfo {
    pub content: String,
    pub length: usize,
    pub encoding: Encoding,
    pub segments: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum TemplateError {
    #[error("Template compilation error: {0}")]
    CompileError(#[from] handlebars::TemplateError),
    #[error("Template rendering error: {0}")]
    RenderError(#[from] handlebars::RenderError),
}

/// Renders a template with the given variables.
/// Variables are specified in the template using {{ var_name }} or {{var_name}}.
pub fn render_template(
    template: &str,
    variables: &HashMap<String, Value>,
) -> Result<SmsInfo, TemplateError> {
    let mut reg = Handlebars::new();
    reg.set_strict_mode(true);
    let rendered = reg.render_template(template, variables)?;
    Ok(analyze_sms(&rendered))
}

pub fn analyze_sms(text: &str) -> SmsInfo {
    let (encoding, length) = calculate_encoding_and_length(text);
    let segments = calculate_segments(length, &encoding);

    SmsInfo {
        content: text.to_string(),
        length,
        encoding,
        segments,
    }
}

/// Checks if character is in the basic GSM-7 character set
fn is_gsm7_basic(c: char) -> bool {
    matches!(
        c,
        '@' | '£' | '$' | '¥' | 'è' | 'é' | 'ù' | 'ì' | 'ò' | 'Ç'
            | '\n' | 'Ø' | 'ø' | '\r' | 'Å' | 'å' | 'Δ' | '_' | 'Φ' | 'Γ'
            | 'Λ' | 'Ω' | 'Π' | 'Ψ' | 'Σ' | 'Θ' | 'Ξ' | '\x1B' | 'Æ' | 'æ'
            | 'ß' | 'É' | ' ' | '!' | '"' | '#' | '¤' | '%' | '&' | '\''
            | '(' | ')' | '*' | '+' | ',' | '-' | '.' | '/' | '0'..='9'
            | ':' | ';' | '<' | '=' | '>' | '?' | '¡' | 'A'..='Z' | 'Ä'
            | 'Ö' | 'Ñ' | 'Ü' | '§' | '¿' | 'a'..='z' | 'ä' | 'ö' | 'ñ'
            | 'ü' | 'à'
    )
}

/// Checks if character is in the extended GSM-7 character set
fn is_gsm7_extended(c: char) -> bool {
    // \x0C is Form Feed
    matches!(
        c,
        '\x0C' | '^' | '{' | '}' | '\\' | '[' | '~' | ']' | '|' | '€'
    )
}

fn calculate_encoding_and_length(text: &str) -> (Encoding, usize) {
    let mut is_gsm7 = true;
    let mut gsm7_len = 0;

    for c in text.chars() {
        if is_gsm7_basic(c) {
            gsm7_len += 1;
        } else if is_gsm7_extended(c) {
            gsm7_len += 2;
        } else {
            is_gsm7 = false;
            break;
        }
    }

    if is_gsm7 {
        (Encoding::Gsm7, gsm7_len)
    } else {
        let ucs2_len = text.encode_utf16().count();
        (Encoding::Ucs2, ucs2_len)
    }
}

fn calculate_segments(length: usize, encoding: &Encoding) -> usize {
    if length == 0 {
        return 1;
    }

    match encoding {
        Encoding::Gsm7 => {
            if length <= 160 {
                1
            } else {
                (length as f64 / 153.0).ceil() as usize
            }
        }
        Encoding::Ucs2 => {
            if length <= 70 {
                1
            } else {
                (length as f64 / 67.0).ceil() as usize
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_template() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), Value::String("Alice".to_string()));
        vars.insert("amount".to_string(), Value::Number(100.into()));

        let result = render_template("Hello {{name}}, your balance is {{ amount }}.", &vars).unwrap();
        assert_eq!(result.content, "Hello Alice, your balance is 100.");
        assert_eq!(result.encoding, Encoding::Gsm7);
        assert_eq!(result.length, 33);
        assert_eq!(result.segments, 1);
    }

    #[test]
    fn test_render_missing_variable() {
        let vars = HashMap::new();
        let result = render_template("Hello {{name}}", &vars);
        assert!(matches!(result, Err(TemplateError::RenderError(_))));
    }

    #[test]
    fn test_gsm7_extended_counting() {
        let info = analyze_sms("Hello {World}");
        // "Hello " = 6, "{World}" = 2 + 5 + 2 = 9. Total 15.
        assert_eq!(info.encoding, Encoding::Gsm7);
        assert_eq!(info.length, 15);
    }

    #[test]
    fn test_ucs2_emoji() {
        let info = analyze_sms("Hello 🌍");
        assert_eq!(info.encoding, Encoding::Ucs2);
        // "Hello " = 6, "🌍" = 2 utf-16 code units. Total 8.
        assert_eq!(info.length, 8);
    }

    #[test]
    fn test_segments_gsm7() {
        let long_text = "A".repeat(160);
        let info = analyze_sms(&long_text);
        assert_eq!(info.segments, 1);

        let long_text2 = "A".repeat(161);
        let info2 = analyze_sms(&long_text2);
        assert_eq!(info2.segments, 2);

        let long_text3 = "A".repeat(306);
        let info3 = analyze_sms(&long_text3);
        assert_eq!(info3.segments, 2);

        let long_text4 = "A".repeat(307);
        let info4 = analyze_sms(&long_text4);
        assert_eq!(info4.segments, 3);
    }

    #[test]
    fn test_segments_ucs2() {
        let text = "🌍".repeat(35); // 70 characters
        let info = analyze_sms(&text);
        assert_eq!(info.segments, 1);

        let text2 = "🌍".repeat(36); // 72 characters
        let info2 = analyze_sms(&text2);
        assert_eq!(info2.segments, 2);
    }
}
