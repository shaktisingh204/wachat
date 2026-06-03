//! SabSheet formula evaluator.
//!
//! A small, deliberately-bounded expression evaluator that understands the
//! subset of spreadsheet syntax required by the SabSheet UI:
//!
//! * Arithmetic: `+ - * / ^ %` with normal precedence and parentheses.
//! * Numbers, strings (single or double-quoted), booleans (`TRUE`/`FALSE`).
//! * Cell refs: `A1`, `B2:D10`, `Sheet2!A1`, named ranges.
//! * Functions: `SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, NOT,
//!   CONCAT, LEN, LOWER, UPPER, TRIM, ROUND, NOW, TODAY, VLOOKUP, INDEX,
//!   MATCH`.
//!
//! The evaluator is sheet-aware via the [`FormulaContext`] trait — callers
//! plug in a `resolve_cell` + `resolve_named_range` implementation and the
//! evaluator just walks the AST. This keeps the engine free of any
//! Mongo / Axum dependency and trivially unit-testable.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A resolved cell coordinate, sheet-qualified.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellAddr {
    /// `None` means "current sheet" — resolved by the caller.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sheet: Option<String>,
    pub row: u32,
    pub col: u32,
}

/// Inclusive cell range.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeAddr {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sheet: Option<String>,
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
}

/// Evaluator value. We keep the shape close to the on-disk `CellValue` but
/// separate from it so the evaluator can produce intermediate types
/// (`#DIV/0!` errors etc.) without polluting the storage type.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Number(f64),
    Text(String),
    Bool(bool),
    Empty,
    Error(String),
}

impl Value {
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            Value::Text(s) => s.trim().parse::<f64>().ok(),
            _ => None,
        }
    }

    pub fn is_truthy(&self) -> bool {
        match self {
            Value::Bool(b) => *b,
            Value::Number(n) => *n != 0.0,
            Value::Text(s) => !s.is_empty(),
            _ => false,
        }
    }

    pub fn to_display_string(&self) -> String {
        match self {
            Value::Number(n) => format_number(*n),
            Value::Text(s) => s.clone(),
            Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_owned(),
            Value::Empty => String::new(),
            Value::Error(e) => e.clone(),
        }
    }
}

fn format_number(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{n}")
    }
}

/// Sheet-side data source. Implementations supply cell values + named
/// ranges; the formula AST does the rest.
pub trait FormulaContext {
    /// Look up a single cell. Empty cells should return `Value::Empty`.
    fn resolve_cell(&self, addr: &CellAddr) -> Value;

    /// Resolve a named range (e.g. `SALES_2024`).
    fn resolve_named_range(&self, name: &str) -> Option<RangeAddr>;

    /// Optional clock injection for `NOW()` / `TODAY()`. Default uses the
    /// system clock so tests can override it.
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// AST.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Number(f64),
    Text(String),
    Bool(bool),
    CellRef(CellAddr),
    RangeRef(RangeAddr),
    NamedRange(String),
    Func {
        name: String,
        args: Vec<Expr>,
    },
    Unary {
        op: char,
        expr: Box<Expr>,
    },
    Binary {
        op: BinOp,
        lhs: Box<Expr>,
        rhs: Box<Expr>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
    Mod,
    Eq,
    Neq,
    Lt,
    Lte,
    Gt,
    Gte,
}

// --------------------------------------------------------------------------
// Tokenizer
// --------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Num(f64),
    Str(String),
    Ident(String),
    Op(char),
    OpPair([char; 2]),
    LParen,
    RParen,
    Comma,
    Colon,
    Bang,
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut out = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
            continue;
        }
        if c.is_ascii_digit() || (c == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit())
        {
            let mut j = i;
            let mut seen_dot = false;
            while j < chars.len() && (chars[j].is_ascii_digit() || (chars[j] == '.' && !seen_dot)) {
                if chars[j] == '.' {
                    seen_dot = true;
                }
                j += 1;
            }
            let n: f64 = chars[i..j]
                .iter()
                .collect::<String>()
                .parse()
                .map_err(|e: std::num::ParseFloatError| e.to_string())?;
            out.push(Token::Num(n));
            i = j;
            continue;
        }
        if c == '"' || c == '\'' {
            let quote = c;
            let mut j = i + 1;
            let mut s = String::new();
            while j < chars.len() && chars[j] != quote {
                s.push(chars[j]);
                j += 1;
            }
            if j >= chars.len() {
                return Err("unterminated string".into());
            }
            out.push(Token::Str(s));
            i = j + 1;
            continue;
        }
        if c.is_ascii_alphabetic() || c == '_' {
            let mut j = i;
            while j < chars.len()
                && (chars[j].is_ascii_alphanumeric() || chars[j] == '_' || chars[j] == '.')
            {
                j += 1;
            }
            out.push(Token::Ident(chars[i..j].iter().collect()));
            i = j;
            continue;
        }
        // Two-char operators
        if i + 1 < chars.len() {
            let pair = [c, chars[i + 1]];
            if matches!(pair, ['<', '='] | ['>', '='] | ['<', '>'] | ['!', '=']) {
                out.push(Token::OpPair(pair));
                i += 2;
                continue;
            }
        }
        match c {
            '(' => out.push(Token::LParen),
            ')' => out.push(Token::RParen),
            ',' => out.push(Token::Comma),
            ':' => out.push(Token::Colon),
            '!' => out.push(Token::Bang),
            '+' | '-' | '*' | '/' | '^' | '%' | '=' | '<' | '>' | '&' => out.push(Token::Op(c)),
            _ => return Err(format!("unexpected char `{c}`")),
        }
        i += 1;
    }
    Ok(out)
}

// --------------------------------------------------------------------------
// Parser (Pratt / recursive descent)
// --------------------------------------------------------------------------

struct Parser {
    toks: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Token> {
        self.toks.get(self.pos)
    }
    fn bump(&mut self) -> Option<Token> {
        let t = self.toks.get(self.pos).cloned();
        if t.is_some() {
            self.pos += 1;
        }
        t
    }
    fn expect(&mut self, t: Token) -> Result<(), String> {
        if self.peek() == Some(&t) {
            self.pos += 1;
            Ok(())
        } else {
            Err(format!("expected {:?}, got {:?}", t, self.peek()))
        }
    }

    fn parse_expr(&mut self) -> Result<Expr, String> {
        self.parse_compare()
    }

    fn parse_compare(&mut self) -> Result<Expr, String> {
        let mut lhs = self.parse_addsub()?;
        while let Some(op) = self.match_compare() {
            let rhs = self.parse_addsub()?;
            lhs = Expr::Binary {
                op,
                lhs: Box::new(lhs),
                rhs: Box::new(rhs),
            };
        }
        Ok(lhs)
    }

    fn match_compare(&mut self) -> Option<BinOp> {
        let op = match self.peek()? {
            Token::Op('=') => BinOp::Eq,
            Token::OpPair(['!', '=']) | Token::OpPair(['<', '>']) => BinOp::Neq,
            Token::Op('<') => BinOp::Lt,
            Token::OpPair(['<', '=']) => BinOp::Lte,
            Token::Op('>') => BinOp::Gt,
            Token::OpPair(['>', '=']) => BinOp::Gte,
            _ => return None,
        };
        self.pos += 1;
        Some(op)
    }

    fn parse_addsub(&mut self) -> Result<Expr, String> {
        let mut lhs = self.parse_muldiv()?;
        while let Some(Token::Op(c @ ('+' | '-' | '&'))) = self.peek().cloned() {
            self.pos += 1;
            let rhs = self.parse_muldiv()?;
            let op = match c {
                '+' => BinOp::Add,
                '-' => BinOp::Sub,
                '&' => {
                    // string concat as ADD with text coercion — handled in eval
                    lhs = Expr::Func {
                        name: "CONCAT".to_owned(),
                        args: vec![lhs, rhs],
                    };
                    continue;
                }
                _ => unreachable!(),
            };
            lhs = Expr::Binary {
                op,
                lhs: Box::new(lhs),
                rhs: Box::new(rhs),
            };
        }
        Ok(lhs)
    }

    fn parse_muldiv(&mut self) -> Result<Expr, String> {
        let mut lhs = self.parse_pow()?;
        while let Some(Token::Op(c @ ('*' | '/' | '%'))) = self.peek().cloned() {
            self.pos += 1;
            let rhs = self.parse_pow()?;
            let op = match c {
                '*' => BinOp::Mul,
                '/' => BinOp::Div,
                '%' => BinOp::Mod,
                _ => unreachable!(),
            };
            lhs = Expr::Binary {
                op,
                lhs: Box::new(lhs),
                rhs: Box::new(rhs),
            };
        }
        Ok(lhs)
    }

    fn parse_pow(&mut self) -> Result<Expr, String> {
        let lhs = self.parse_unary()?;
        if let Some(Token::Op('^')) = self.peek() {
            self.pos += 1;
            let rhs = self.parse_pow()?; // right-assoc
            return Ok(Expr::Binary {
                op: BinOp::Pow,
                lhs: Box::new(lhs),
                rhs: Box::new(rhs),
            });
        }
        Ok(lhs)
    }

    fn parse_unary(&mut self) -> Result<Expr, String> {
        if let Some(Token::Op(c @ ('-' | '+'))) = self.peek().cloned() {
            self.pos += 1;
            let expr = self.parse_unary()?;
            return Ok(Expr::Unary {
                op: c,
                expr: Box::new(expr),
            });
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<Expr, String> {
        match self.bump() {
            Some(Token::Num(n)) => Ok(Expr::Number(n)),
            Some(Token::Str(s)) => Ok(Expr::Text(s)),
            Some(Token::LParen) => {
                let e = self.parse_expr()?;
                self.expect(Token::RParen)?;
                Ok(e)
            }
            Some(Token::Ident(name)) => {
                // Sheet-qualified ref: `Sheet2!A1` or `Sheet2!A1:B3`.
                let qualifier = if let Some(Token::Bang) = self.peek() {
                    self.pos += 1;
                    Some(name.clone())
                } else {
                    None
                };
                let head = if qualifier.is_some() {
                    match self.bump() {
                        Some(Token::Ident(n)) => n,
                        other => return Err(format!("expected ref after `!`, got {other:?}")),
                    }
                } else {
                    name
                };
                let upper = head.to_uppercase();
                // FUNCTION?
                if let Some(Token::LParen) = self.peek() {
                    if qualifier.is_some() {
                        return Err("sheet-qualified function call is not supported".into());
                    }
                    self.pos += 1;
                    let mut args = Vec::new();
                    if !matches!(self.peek(), Some(Token::RParen)) {
                        loop {
                            args.push(self.parse_expr()?);
                            if let Some(Token::Comma) = self.peek() {
                                self.pos += 1;
                            } else {
                                break;
                            }
                        }
                    }
                    self.expect(Token::RParen)?;
                    return Ok(Expr::Func { name: upper, args });
                }
                // CELL or RANGE?
                if let Some((r, c)) = parse_cell_ref(&head) {
                    let start = CellAddr {
                        sheet: qualifier.clone(),
                        row: r,
                        col: c,
                    };
                    if let Some(Token::Colon) = self.peek() {
                        self.pos += 1;
                        match self.bump() {
                            Some(Token::Ident(end)) => {
                                let (er, ec) = parse_cell_ref(&end)
                                    .ok_or_else(|| format!("invalid range end `{end}`"))?;
                                return Ok(Expr::RangeRef(RangeAddr {
                                    sheet: qualifier,
                                    start_row: start.row,
                                    start_col: start.col,
                                    end_row: er,
                                    end_col: ec,
                                }));
                            }
                            other => return Err(format!("expected range end, got {other:?}")),
                        }
                    }
                    return Ok(Expr::CellRef(start));
                }
                // Boolean literals
                match upper.as_str() {
                    "TRUE" => Ok(Expr::Bool(true)),
                    "FALSE" => Ok(Expr::Bool(false)),
                    _ => Ok(Expr::NamedRange(head)),
                }
            }
            other => Err(format!("unexpected token {:?}", other)),
        }
    }
}

/// Parse a string like `B12` into `(row=11, col=1)` (0-indexed).
pub fn parse_cell_ref(s: &str) -> Option<(u32, u32)> {
    let mut chars = s.chars();
    let mut col_part = String::new();
    let mut row_part = String::new();
    let mut seen_digit = false;
    for c in &mut chars {
        if c.is_ascii_alphabetic() && !seen_digit {
            col_part.push(c.to_ascii_uppercase());
        } else if c.is_ascii_digit() {
            seen_digit = true;
            row_part.push(c);
        } else {
            return None;
        }
    }
    if col_part.is_empty() || row_part.is_empty() {
        return None;
    }
    let mut col: u32 = 0;
    for c in col_part.chars() {
        col = col * 26 + (c as u32 - 'A' as u32 + 1);
    }
    let row: u32 = row_part.parse().ok()?;
    Some((row.saturating_sub(1), col.saturating_sub(1)))
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/// Parse a formula source string (without the leading `=`) into an AST.
pub fn parse(src: &str) -> Result<Expr, String> {
    let toks = tokenize(src)?;
    let mut p = Parser { toks, pos: 0 };
    let e = p.parse_expr()?;
    if p.pos != p.toks.len() {
        return Err(format!("trailing tokens at {}", p.pos));
    }
    Ok(e)
}

/// Walk a parsed AST and produce the list of cells it directly depends on.
/// Used by the storage layer to populate `Cell.dependsOn` for invalidation.
pub fn collect_dependencies(expr: &Expr) -> Vec<CellAddr> {
    let mut out = Vec::new();
    walk(expr, &mut out, &HashMap::new());
    out
}

fn walk(expr: &Expr, out: &mut Vec<CellAddr>, _named: &HashMap<String, RangeAddr>) {
    match expr {
        Expr::CellRef(c) => out.push(c.clone()),
        Expr::RangeRef(r) => {
            for row in r.start_row..=r.end_row {
                for col in r.start_col..=r.end_col {
                    out.push(CellAddr {
                        sheet: r.sheet.clone(),
                        row,
                        col,
                    });
                }
            }
        }
        Expr::Unary { expr, .. } => walk(expr, out, _named),
        Expr::Binary { lhs, rhs, .. } => {
            walk(lhs, out, _named);
            walk(rhs, out, _named);
        }
        Expr::Func { args, .. } => {
            for a in args {
                walk(a, out, _named);
            }
        }
        _ => {}
    }
}

/// Evaluate an AST against a [`FormulaContext`].
pub fn eval<C: FormulaContext>(expr: &Expr, ctx: &C) -> Value {
    match expr {
        Expr::Number(n) => Value::Number(*n),
        Expr::Text(s) => Value::Text(s.clone()),
        Expr::Bool(b) => Value::Bool(*b),
        Expr::CellRef(c) => ctx.resolve_cell(c),
        Expr::NamedRange(name) => match ctx.resolve_named_range(name) {
            Some(r) => sum_range(&r, ctx), // bare named range used as a scalar → SUM
            None => Value::Error(format!("#NAME?({name})")),
        },
        Expr::RangeRef(r) => sum_range(r, ctx),
        Expr::Unary { op, expr } => {
            let v = eval(expr, ctx);
            match (op, v) {
                ('-', Value::Number(n)) => Value::Number(-n),
                ('+', v) => v,
                _ => Value::Error("#VALUE!".into()),
            }
        }
        Expr::Binary { op, lhs, rhs } => eval_binary(*op, eval(lhs, ctx), eval(rhs, ctx)),
        Expr::Func { name, args } => eval_func(name, args, ctx),
    }
}

fn sum_range<C: FormulaContext>(r: &RangeAddr, ctx: &C) -> Value {
    let mut sum = 0.0;
    for row in r.start_row..=r.end_row {
        for col in r.start_col..=r.end_col {
            if let Value::Number(n) = ctx.resolve_cell(&CellAddr {
                sheet: r.sheet.clone(),
                row,
                col,
            }) {
                sum += n;
            }
        }
    }
    Value::Number(sum)
}

fn eval_binary(op: BinOp, lhs: Value, rhs: Value) -> Value {
    use BinOp::*;
    let l = lhs.as_number();
    let r = rhs.as_number();
    match (op, l, r) {
        (Add, Some(a), Some(b)) => Value::Number(a + b),
        (Sub, Some(a), Some(b)) => Value::Number(a - b),
        (Mul, Some(a), Some(b)) => Value::Number(a * b),
        (Div, Some(_), Some(0.0)) => Value::Error("#DIV/0!".into()),
        (Div, Some(a), Some(b)) => Value::Number(a / b),
        (Mod, Some(_), Some(0.0)) => Value::Error("#DIV/0!".into()),
        (Mod, Some(a), Some(b)) => Value::Number(a % b),
        (Pow, Some(a), Some(b)) => Value::Number(a.powf(b)),
        (Eq, _, _) => Value::Bool(lhs == rhs),
        (Neq, _, _) => Value::Bool(lhs != rhs),
        (Lt, Some(a), Some(b)) => Value::Bool(a < b),
        (Lte, Some(a), Some(b)) => Value::Bool(a <= b),
        (Gt, Some(a), Some(b)) => Value::Bool(a > b),
        (Gte, Some(a), Some(b)) => Value::Bool(a >= b),
        _ => Value::Error("#VALUE!".into()),
    }
}

fn eval_func<C: FormulaContext>(name: &str, args: &[Expr], ctx: &C) -> Value {
    let flat = |args: &[Expr]| -> Vec<Value> {
        let mut out = Vec::new();
        for a in args {
            match a {
                Expr::RangeRef(r) => {
                    for row in r.start_row..=r.end_row {
                        for col in r.start_col..=r.end_col {
                            out.push(ctx.resolve_cell(&CellAddr {
                                sheet: r.sheet.clone(),
                                row,
                                col,
                            }));
                        }
                    }
                }
                other => out.push(eval(other, ctx)),
            }
        }
        out
    };

    match name {
        "SUM" => {
            let vs = flat(args);
            Value::Number(vs.iter().filter_map(Value::as_number).sum())
        }
        "AVERAGE" => {
            let vs: Vec<f64> = flat(args).iter().filter_map(Value::as_number).collect();
            if vs.is_empty() {
                Value::Error("#DIV/0!".into())
            } else {
                Value::Number(vs.iter().sum::<f64>() / vs.len() as f64)
            }
        }
        "MIN" => flat(args)
            .iter()
            .filter_map(Value::as_number)
            .fold(None, |acc: Option<f64>, n| {
                Some(acc.map_or(n, |a| a.min(n)))
            })
            .map(Value::Number)
            .unwrap_or(Value::Error("#NUM!".into())),
        "MAX" => flat(args)
            .iter()
            .filter_map(Value::as_number)
            .fold(None, |acc: Option<f64>, n| {
                Some(acc.map_or(n, |a| a.max(n)))
            })
            .map(Value::Number)
            .unwrap_or(Value::Error("#NUM!".into())),
        "COUNT" => Value::Number(
            flat(args)
                .iter()
                .filter(|v| matches!(v, Value::Number(_)))
                .count() as f64,
        ),
        "COUNTA" => Value::Number(
            flat(args)
                .iter()
                .filter(|v| !matches!(v, Value::Empty))
                .count() as f64,
        ),
        "IF" => match args {
            [cond, then_, else_] => {
                if eval(cond, ctx).is_truthy() {
                    eval(then_, ctx)
                } else {
                    eval(else_, ctx)
                }
            }
            [cond, then_] => {
                if eval(cond, ctx).is_truthy() {
                    eval(then_, ctx)
                } else {
                    Value::Bool(false)
                }
            }
            _ => Value::Error("#N/A IF arity".into()),
        },
        "AND" => Value::Bool(flat(args).iter().all(|v| v.is_truthy())),
        "OR" => Value::Bool(flat(args).iter().any(|v| v.is_truthy())),
        "NOT" => match args {
            [a] => Value::Bool(!eval(a, ctx).is_truthy()),
            _ => Value::Error("#N/A NOT arity".into()),
        },
        "CONCAT" => {
            let s: String = args
                .iter()
                .map(|a| eval(a, ctx).to_display_string())
                .collect();
            Value::Text(s)
        }
        "LEN" => match args {
            [a] => Value::Number(eval(a, ctx).to_display_string().chars().count() as f64),
            _ => Value::Error("#N/A LEN arity".into()),
        },
        "LOWER" => match args {
            [a] => Value::Text(eval(a, ctx).to_display_string().to_lowercase()),
            _ => Value::Error("#N/A LOWER arity".into()),
        },
        "UPPER" => match args {
            [a] => Value::Text(eval(a, ctx).to_display_string().to_uppercase()),
            _ => Value::Error("#N/A UPPER arity".into()),
        },
        "TRIM" => match args {
            [a] => Value::Text(eval(a, ctx).to_display_string().trim().to_owned()),
            _ => Value::Error("#N/A TRIM arity".into()),
        },
        "ROUND" => match args {
            [a, digits] => {
                let n = eval(a, ctx).as_number().unwrap_or(0.0);
                let d = eval(digits, ctx).as_number().unwrap_or(0.0).round() as i32;
                let f = 10f64.powi(d);
                Value::Number((n * f).round() / f)
            }
            [a] => {
                let n = eval(a, ctx).as_number().unwrap_or(0.0);
                Value::Number(n.round())
            }
            _ => Value::Error("#N/A ROUND arity".into()),
        },
        "NOW" => Value::Text(ctx.now().to_rfc3339()),
        "TODAY" => Value::Text(ctx.now().date_naive().to_string()),
        "VLOOKUP" => match args {
            [needle, range, col_idx, ..] => {
                let needle_v = eval(needle, ctx);
                let col_idx_v = eval(col_idx, ctx).as_number().unwrap_or(1.0) as i64;
                if let Expr::RangeRef(r) = range {
                    for row in r.start_row..=r.end_row {
                        let first = ctx.resolve_cell(&CellAddr {
                            sheet: r.sheet.clone(),
                            row,
                            col: r.start_col,
                        });
                        if first == needle_v {
                            let target_col = r.start_col + (col_idx_v.saturating_sub(1)) as u32;
                            return ctx.resolve_cell(&CellAddr {
                                sheet: r.sheet.clone(),
                                row,
                                col: target_col,
                            });
                        }
                    }
                    Value::Error("#N/A".into())
                } else {
                    Value::Error("#N/A VLOOKUP range".into())
                }
            }
            _ => Value::Error("#N/A VLOOKUP arity".into()),
        },
        "MATCH" => match args {
            [needle, range, ..] => {
                let needle_v = eval(needle, ctx);
                if let Expr::RangeRef(r) = range {
                    let mut idx = 1u32;
                    for row in r.start_row..=r.end_row {
                        for col in r.start_col..=r.end_col {
                            let v = ctx.resolve_cell(&CellAddr {
                                sheet: r.sheet.clone(),
                                row,
                                col,
                            });
                            if v == needle_v {
                                return Value::Number(idx as f64);
                            }
                            idx += 1;
                        }
                    }
                    Value::Error("#N/A".into())
                } else {
                    Value::Error("#N/A MATCH range".into())
                }
            }
            _ => Value::Error("#N/A MATCH arity".into()),
        },
        "INDEX" => match args {
            [range, row_n, col_n] => {
                let r_off = eval(row_n, ctx).as_number().unwrap_or(1.0) as u32;
                let c_off = eval(col_n, ctx).as_number().unwrap_or(1.0) as u32;
                if let Expr::RangeRef(r) = range {
                    ctx.resolve_cell(&CellAddr {
                        sheet: r.sheet.clone(),
                        row: r.start_row + r_off.saturating_sub(1),
                        col: r.start_col + c_off.saturating_sub(1),
                    })
                } else {
                    Value::Error("#N/A INDEX range".into())
                }
            }
            _ => Value::Error("#N/A INDEX arity".into()),
        },
        _ => Value::Error(format!("#NAME?({name})")),
    }
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    struct StubCtx;
    impl FormulaContext for StubCtx {
        fn resolve_cell(&self, addr: &CellAddr) -> Value {
            // A1=1, A2=2, A3=3, B1="x"
            match (addr.row, addr.col) {
                (0, 0) => Value::Number(1.0),
                (1, 0) => Value::Number(2.0),
                (2, 0) => Value::Number(3.0),
                (0, 1) => Value::Text("x".into()),
                _ => Value::Empty,
            }
        }
        fn resolve_named_range(&self, name: &str) -> Option<RangeAddr> {
            if name == "RANGE_A" {
                Some(RangeAddr {
                    sheet: None,
                    start_row: 0,
                    start_col: 0,
                    end_row: 2,
                    end_col: 0,
                })
            } else {
                None
            }
        }
    }

    #[test]
    fn parses_cell_ref() {
        assert_eq!(parse_cell_ref("A1"), Some((0, 0)));
        assert_eq!(parse_cell_ref("B12"), Some((11, 1)));
        assert_eq!(parse_cell_ref("AA1"), Some((0, 26)));
    }

    #[test]
    fn evaluates_arithmetic() {
        let ast = parse("1 + 2 * 3").unwrap();
        assert_eq!(eval(&ast, &StubCtx), Value::Number(7.0));
    }

    #[test]
    fn evaluates_sum_range() {
        let ast = parse("SUM(A1:A3)").unwrap();
        assert_eq!(eval(&ast, &StubCtx), Value::Number(6.0));
    }

    #[test]
    fn evaluates_if_and_concat() {
        let ast = parse("IF(A1=1, CONCAT(\"v=\", A1), 0)").unwrap();
        assert_eq!(eval(&ast, &StubCtx), Value::Text("v=1".into()));
    }

    #[test]
    fn named_range_as_scalar_sums() {
        let ast = parse("RANGE_A").unwrap();
        assert_eq!(eval(&ast, &StubCtx), Value::Number(6.0));
    }

    #[test]
    fn collects_dependencies() {
        let ast = parse("A1 + B1 + SUM(A2:A3)").unwrap();
        let deps = collect_dependencies(&ast);
        assert!(deps.iter().any(|d| d.row == 0 && d.col == 0));
        assert!(deps.iter().any(|d| d.row == 0 && d.col == 1));
        assert!(deps.iter().any(|d| d.row == 1 && d.col == 0));
        assert!(deps.iter().any(|d| d.row == 2 && d.col == 0));
    }
}
