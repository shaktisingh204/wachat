//! Tiny safe formula evaluator for SabTables.
//!
//! Grammar (subset of Airtable's formula DSL):
//!
//! ```text
//! expr      := add
//! add       := mul ( ('+' | '-') mul )*
//! mul       := unary ( ('*' | '/') unary )*
//! unary     := '-' unary | call
//! call      := IDENT '(' arglist? ')' | atom
//! atom      := NUMBER | STRING | FIELDREF | '(' expr ')'
//! FIELDREF  := '{' [^}]+ '}'
//! STRING    := "..." | '...'
//! ```
//!
//! Supported builtins: `IF(cond, a, b)`, `CONCAT(a, b, …)`,
//! `LEN(s)`, `LOWER(s)`, `UPPER(s)`. The evaluator is **pure** —
//! no I/O, no recursion into other records — so it is safe to call
//! from anywhere on the request path.
//!
//! Values are dynamically typed `Value` (Number | Text | Bool | Empty).
//! Coercions follow Airtable conventions: arithmetic coerces text→
//! number when possible; `CONCAT`/`LEN`/`LOWER`/`UPPER` coerce to text.

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Number(f64),
    Text(String),
    Bool(bool),
    Empty,
}

impl Value {
    pub fn to_number(&self) -> f64 {
        match self {
            Value::Number(n) => *n,
            Value::Text(s) => s.trim().parse::<f64>().unwrap_or(0.0),
            Value::Bool(true) => 1.0,
            Value::Bool(false) => 0.0,
            Value::Empty => 0.0,
        }
    }

    pub fn to_text(&self) -> String {
        match self {
            Value::Number(n) => {
                if n.fract() == 0.0 && n.abs() < 1e16 {
                    format!("{}", *n as i64)
                } else {
                    format!("{}", n)
                }
            }
            Value::Text(s) => s.clone(),
            Value::Bool(b) => {
                if *b {
                    "true".to_owned()
                } else {
                    "false".to_owned()
                }
            }
            Value::Empty => String::new(),
        }
    }

    pub fn to_bool(&self) -> bool {
        match self {
            Value::Number(n) => *n != 0.0,
            Value::Text(s) => !s.is_empty(),
            Value::Bool(b) => *b,
            Value::Empty => false,
        }
    }

    pub fn to_json(&self) -> serde_json::Value {
        match self {
            Value::Number(n) => serde_json::Value::from(*n),
            Value::Text(s) => serde_json::Value::String(s.clone()),
            Value::Bool(b) => serde_json::Value::Bool(*b),
            Value::Empty => serde_json::Value::Null,
        }
    }

    pub fn from_json(v: &serde_json::Value) -> Value {
        match v {
            serde_json::Value::Null => Value::Empty,
            serde_json::Value::Bool(b) => Value::Bool(*b),
            serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
            serde_json::Value::String(s) => Value::Text(s.clone()),
            other => Value::Text(other.to_string()),
        }
    }
}

#[derive(Debug)]
pub struct FormulaError(pub String);

impl std::fmt::Display for FormulaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "formula error: {}", self.0)
    }
}

impl std::error::Error for FormulaError {}

// =========================================================================
// Tokenizer
// =========================================================================

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(f64),
    Text(String),
    Ident(String),
    FieldRef(String),
    LParen,
    RParen,
    Comma,
    Plus,
    Minus,
    Star,
    Slash,
}

fn tokenize(src: &str) -> Result<Vec<Token>, FormulaError> {
    let mut out = Vec::new();
    let mut chars = src.chars().peekable();
    while let Some(&c) = chars.peek() {
        match c {
            ' ' | '\t' | '\n' | '\r' => {
                chars.next();
            }
            '(' => {
                chars.next();
                out.push(Token::LParen);
            }
            ')' => {
                chars.next();
                out.push(Token::RParen);
            }
            ',' => {
                chars.next();
                out.push(Token::Comma);
            }
            '+' => {
                chars.next();
                out.push(Token::Plus);
            }
            '-' => {
                chars.next();
                out.push(Token::Minus);
            }
            '*' => {
                chars.next();
                out.push(Token::Star);
            }
            '/' => {
                chars.next();
                out.push(Token::Slash);
            }
            '{' => {
                chars.next();
                let mut name = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch == '}' {
                        chars.next();
                        break;
                    }
                    name.push(ch);
                    chars.next();
                }
                out.push(Token::FieldRef(name.trim().to_owned()));
            }
            '"' | '\'' => {
                let quote = c;
                chars.next();
                let mut s = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch == quote {
                        chars.next();
                        break;
                    }
                    if ch == '\\' {
                        chars.next();
                        if let Some(&esc) = chars.peek() {
                            chars.next();
                            s.push(esc);
                        }
                    } else {
                        s.push(ch);
                        chars.next();
                    }
                }
                out.push(Token::Text(s));
            }
            ch if ch.is_ascii_digit() || ch == '.' => {
                let mut n = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_ascii_digit() || ch == '.' {
                        n.push(ch);
                        chars.next();
                    } else {
                        break;
                    }
                }
                let v = n
                    .parse::<f64>()
                    .map_err(|_| FormulaError(format!("bad number literal \"{n}\"")))?;
                out.push(Token::Number(v));
            }
            ch if ch.is_ascii_alphabetic() || ch == '_' => {
                let mut id = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_ascii_alphanumeric() || ch == '_' {
                        id.push(ch);
                        chars.next();
                    } else {
                        break;
                    }
                }
                out.push(Token::Ident(id));
            }
            _ => {
                return Err(FormulaError(format!("unexpected character \"{c}\"")));
            }
        }
    }
    Ok(out)
}

// =========================================================================
// Parser + Evaluator (recursive descent, eval-as-you-parse)
// =========================================================================

struct Parser<'a> {
    tokens: Vec<Token>,
    pos: usize,
    fields: &'a HashMap<String, Value>,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn eat(&mut self) -> Option<Token> {
        let t = self.tokens.get(self.pos).cloned();
        if t.is_some() {
            self.pos += 1;
        }
        t
    }

    fn expect(&mut self, expected: &Token) -> Result<(), FormulaError> {
        match self.eat() {
            Some(t) if std::mem::discriminant(&t) == std::mem::discriminant(expected) => Ok(()),
            other => Err(FormulaError(format!(
                "expected {expected:?}, got {other:?}"
            ))),
        }
    }

    fn parse_expr(&mut self) -> Result<Value, FormulaError> {
        self.parse_add()
    }

    fn parse_add(&mut self) -> Result<Value, FormulaError> {
        let mut left = self.parse_mul()?;
        loop {
            match self.peek() {
                Some(Token::Plus) => {
                    self.eat();
                    let right = self.parse_mul()?;
                    // `+` concatenates if either side is text and not numeric.
                    if matches!(left, Value::Text(_)) || matches!(right, Value::Text(_)) {
                        // If both look numeric, prefer numeric add; else concat.
                        let ln = left.to_number();
                        let rn = right.to_number();
                        let both_numeric = !left.to_text().is_empty()
                            && !right.to_text().is_empty()
                            && left
                                .to_text()
                                .chars()
                                .all(|c| c.is_ascii_digit() || c == '.' || c == '-')
                            && right
                                .to_text()
                                .chars()
                                .all(|c| c.is_ascii_digit() || c == '.' || c == '-');
                        left = if both_numeric {
                            Value::Number(ln + rn)
                        } else {
                            Value::Text(format!("{}{}", left.to_text(), right.to_text()))
                        };
                    } else {
                        left = Value::Number(left.to_number() + right.to_number());
                    }
                }
                Some(Token::Minus) => {
                    self.eat();
                    let right = self.parse_mul()?;
                    left = Value::Number(left.to_number() - right.to_number());
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_mul(&mut self) -> Result<Value, FormulaError> {
        let mut left = self.parse_unary()?;
        loop {
            match self.peek() {
                Some(Token::Star) => {
                    self.eat();
                    let right = self.parse_unary()?;
                    left = Value::Number(left.to_number() * right.to_number());
                }
                Some(Token::Slash) => {
                    self.eat();
                    let right = self.parse_unary()?;
                    let rn = right.to_number();
                    if rn == 0.0 {
                        return Err(FormulaError("division by zero".to_owned()));
                    }
                    left = Value::Number(left.to_number() / rn);
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Value, FormulaError> {
        if let Some(Token::Minus) = self.peek() {
            self.eat();
            let v = self.parse_unary()?;
            return Ok(Value::Number(-v.to_number()));
        }
        self.parse_atom()
    }

    fn parse_atom(&mut self) -> Result<Value, FormulaError> {
        match self.eat() {
            Some(Token::Number(n)) => Ok(Value::Number(n)),
            Some(Token::Text(s)) => Ok(Value::Text(s)),
            Some(Token::FieldRef(name)) => {
                Ok(self.fields.get(&name).cloned().unwrap_or(Value::Empty))
            }
            Some(Token::LParen) => {
                let v = self.parse_expr()?;
                self.expect(&Token::RParen)?;
                Ok(v)
            }
            Some(Token::Ident(name)) => {
                // Function call? Then `LParen` follows; else treat as field-name shortcut.
                if matches!(self.peek(), Some(Token::LParen)) {
                    self.eat(); // consume LParen
                    let mut args = Vec::new();
                    if !matches!(self.peek(), Some(Token::RParen)) {
                        loop {
                            args.push(self.parse_expr()?);
                            if matches!(self.peek(), Some(Token::Comma)) {
                                self.eat();
                            } else {
                                break;
                            }
                        }
                    }
                    self.expect(&Token::RParen)?;
                    self.call_builtin(&name, args)
                } else if name.eq_ignore_ascii_case("true") {
                    Ok(Value::Bool(true))
                } else if name.eq_ignore_ascii_case("false") {
                    Ok(Value::Bool(false))
                } else {
                    // Bare identifier — treat as field reference too.
                    Ok(self.fields.get(&name).cloned().unwrap_or(Value::Empty))
                }
            }
            other => Err(FormulaError(format!("unexpected token {other:?}"))),
        }
    }

    fn call_builtin(&mut self, name: &str, args: Vec<Value>) -> Result<Value, FormulaError> {
        let upper = name.to_ascii_uppercase();
        match upper.as_str() {
            "IF" => {
                if args.len() != 3 {
                    return Err(FormulaError(format!(
                        "IF expects 3 args, got {}",
                        args.len()
                    )));
                }
                if args[0].to_bool() {
                    Ok(args[1].clone())
                } else {
                    Ok(args[2].clone())
                }
            }
            "CONCAT" => Ok(Value::Text(
                args.iter().map(|v| v.to_text()).collect::<String>(),
            )),
            "LEN" => {
                if args.len() != 1 {
                    return Err(FormulaError(format!(
                        "LEN expects 1 arg, got {}",
                        args.len()
                    )));
                }
                Ok(Value::Number(args[0].to_text().chars().count() as f64))
            }
            "LOWER" => {
                if args.len() != 1 {
                    return Err(FormulaError(format!(
                        "LOWER expects 1 arg, got {}",
                        args.len()
                    )));
                }
                Ok(Value::Text(args[0].to_text().to_lowercase()))
            }
            "UPPER" => {
                if args.len() != 1 {
                    return Err(FormulaError(format!(
                        "UPPER expects 1 arg, got {}",
                        args.len()
                    )));
                }
                Ok(Value::Text(args[0].to_text().to_uppercase()))
            }
            other => Err(FormulaError(format!("unknown function \"{other}\""))),
        }
    }
}

/// Evaluate a formula expression against a `field name -> value` map.
pub fn evaluate(expression: &str, fields: &HashMap<String, Value>) -> Result<Value, FormulaError> {
    let tokens = tokenize(expression)?;
    let mut p = Parser {
        tokens,
        pos: 0,
        fields,
    };
    let v = p.parse_expr()?;
    if p.peek().is_some() {
        return Err(FormulaError("trailing tokens after expression".to_owned()));
    }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eval(src: &str) -> Value {
        evaluate(src, &HashMap::new()).unwrap()
    }

    #[test]
    fn arithmetic() {
        assert_eq!(eval("1 + 2 * 3"), Value::Number(7.0));
        assert_eq!(eval("(1 + 2) * 3"), Value::Number(9.0));
        assert_eq!(eval("10 / 4"), Value::Number(2.5));
        assert_eq!(eval("-5 + 8"), Value::Number(3.0));
    }

    #[test]
    fn if_builtin() {
        assert_eq!(eval("IF(1, \"a\", \"b\")"), Value::Text("a".into()));
        assert_eq!(eval("IF(0, \"a\", \"b\")"), Value::Text("b".into()));
    }

    #[test]
    fn concat_len_case() {
        assert_eq!(
            eval("CONCAT(\"hi\", \" \", \"there\")"),
            Value::Text("hi there".into())
        );
        assert_eq!(eval("LEN(\"hello\")"), Value::Number(5.0));
        assert_eq!(eval("UPPER(\"abc\")"), Value::Text("ABC".into()));
        assert_eq!(eval("LOWER(\"XYZ\")"), Value::Text("xyz".into()));
    }

    #[test]
    fn field_ref() {
        let mut fields = HashMap::new();
        fields.insert("Qty".to_owned(), Value::Number(3.0));
        fields.insert("Price".to_owned(), Value::Number(10.5));
        let v = evaluate("{Qty} * {Price}", &fields).unwrap();
        assert_eq!(v, Value::Number(31.5));
    }

    #[test]
    fn division_by_zero() {
        assert!(evaluate("1 / 0", &HashMap::new()).is_err());
    }
}
