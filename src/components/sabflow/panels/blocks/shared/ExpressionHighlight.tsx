'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   ExpressionHighlight
   ────────────────────────────────────────────────────────────────────────────
   Read-only display that syntax-highlights an n8n-style expression.

     $json, $node, $input, $vars, $now, $env   → purple
     "…", '…'                                  → green (string literals)
     123, 3.14                                 → blue (numbers)
     + - * / = > < && || ? :                   → gray (operators)
     identifiers                               → default

   The tokenizer is a single-pass linear scanner — no regex backtracking, no
   eval — so it is safe for arbitrary user input.
   ──────────────────────────────────────────────────────────────────────────── */

import { memo, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ── Token kinds ──────────────────────────────────────────────────────────── */

type TokenKind =
  | 'expr-root' // $json, $node, $vars, etc.
  | 'string'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'identifier'
  | 'whitespace';

interface Token {
  kind: TokenKind;
  text: string;
}

/* ── Known expression roots ────────────────────────────────────────────────── */

const EXPR_ROOTS = new Set([
  '$json',
  '$node',
  '$input',
  '$vars',
  '$now',
  '$env',
  '$workflow',
  '$execution',
  '$itemIndex',
  '$runIndex',
  '$prevNode',
]);

const OPERATOR_CHARS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '!',
  '<',
  '>',
  '&',
  '|',
  '?',
  ':',
  '^',
  '~',
]);

const PUNCT_CHARS = new Set(['(', ')', '[', ']', '{', '}', ',', '.', ';']);

/* ── Tokenizer ────────────────────────────────────────────────────────────── */

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const length = source.length;
  let index = 0;

  while (index < length) {
    const char = source[index];

    // Whitespace
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      let end = index + 1;
      while (
        end < length &&
        (source[end] === ' ' ||
          source[end] === '\t' ||
          source[end] === '\n' ||
          source[end] === '\r')
      ) {
        end += 1;
      }
      tokens.push({ kind: 'whitespace', text: source.slice(index, end) });
      index = end;
      continue;
    }

    // String literal ("…" or '…' or `…`)
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let end = index + 1;
      while (end < length) {
        const c = source[end];
        if (c === '\\' && end + 1 < length) {
          end += 2;
          continue;
        }
        if (c === quote) {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ kind: 'string', text: source.slice(index, end) });
      index = end;
      continue;
    }

    // Number (digit or `.digit`)
    if (
      (char >= '0' && char <= '9') ||
      (char === '.' && index + 1 < length && source[index + 1] >= '0' && source[index + 1] <= '9')
    ) {
      let end = index;
      let sawDot = false;
      while (end < length) {
        const c = source[end];
        if (c >= '0' && c <= '9') {
          end += 1;
        } else if (c === '.' && !sawDot) {
          sawDot = true;
          end += 1;
        } else {
          break;
        }
      }
      tokens.push({ kind: 'number', text: source.slice(index, end) });
      index = end;
      continue;
    }

    // Expression root ($json, $node, …) or $identifier
    if (char === '$') {
      let end = index + 1;
      while (
        end < length &&
        (isIdentifierChar(source[end]) || source[end] >= '0')
      ) {
        const c = source[end];
        if (isIdentifierChar(c) || (c >= '0' && c <= '9')) end += 1;
        else break;
      }
      const text = source.slice(index, end);
      tokens.push({
        kind: EXPR_ROOTS.has(text) ? 'expr-root' : 'identifier',
        text,
      });
      index = end;
      continue;
    }

    // Identifier
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < length && (isIdentifierChar(source[end]) || (source[end] >= '0' && source[end] <= '9'))) {
        end += 1;
      }
      tokens.push({ kind: 'identifier', text: source.slice(index, end) });
      index = end;
      continue;
    }

    // Operator (possibly multi-char, e.g. ===, &&, >=)
    if (OPERATOR_CHARS.has(char)) {
      let end = index + 1;
      while (end < length && OPERATOR_CHARS.has(source[end])) end += 1;
      tokens.push({ kind: 'operator', text: source.slice(index, end) });
      index = end;
      continue;
    }

    // Punctuation
    if (PUNCT_CHARS.has(char)) {
      tokens.push({ kind: 'punctuation', text: char });
      index += 1;
      continue;
    }

    // Fallback — treat unknown char as identifier-ish so nothing is dropped.
    tokens.push({ kind: 'identifier', text: char });
    index += 1;
  }

  return tokens;
}

function isIdentifierStart(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
}

function isIdentifierChar(char: string): boolean {
  return isIdentifierStart(char) || (char >= '0' && char <= '9');
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

const TOKEN_CLASS: Record<TokenKind, string> = {
  'expr-root': 'text-purple-400 font-medium',
  string: 'text-emerald-400',
  number: 'text-sky-400',
  operator: 'text-[var(--gray-9)]',
  punctuation: 'text-[var(--gray-9)]',
  identifier: 'text-[var(--gray-12)]',
  whitespace: '',
};

export interface ExpressionHighlightProps {
  /** Expression source (without leading `=`) */
  expression: string;
  className?: string;
}

function ExpressionHighlightInner({
  expression,
  className,
}: ExpressionHighlightProps): ReactNode {
  const tokens = useMemo(() => tokenize(expression), [expression]);
  return (
    <span className={cn('font-mono whitespace-pre-wrap break-words', className)}>
      {tokens.map((token, index) =>
        token.kind === 'whitespace' ? (
          <span key={index}>{token.text}</span>
        ) : (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </span>
  );
}

export const ExpressionHighlight = memo(ExpressionHighlightInner);
