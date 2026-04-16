'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { ChatBubble } from '../ChatBubble';

export interface TextBubbleProps {
  /** Raw message text — may contain `{{variable}}` tokens and markdown-ish formatting. */
  text: string;
  /** `'bot'` = left-aligned host bubble; `'user'` = right-aligned guest bubble. */
  variant: 'bot' | 'user';
  /** Variable map used to resolve `{{token}}` placeholders. */
  variables?: Record<string, string | undefined>;
  /** Override bubble background colour. */
  backgroundColor?: string;
  /** Override bubble text colour. */
  color?: string;
  /** Accent colour used for markdown links. */
  linkColor?: string;
}

/* ── Variable substitution ─────────────────────────────────────────────── */

const VAR_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function substituteTokens(
  text: string,
  variables: Record<string, string | undefined> | undefined,
): string {
  if (!text) return '';
  if (!variables) return text;
  return text.replace(VAR_RE, (match, name: string) => {
    const value = variables[name.trim()];
    return typeof value === 'string' ? value : match;
  });
}

/* ── Markdown-style inline formatter ───────────────────────────────────── */

/**
 * Safe URL predicate — we only render `<a>` elements for `http(s)://`,
 * `mailto:`, or `tel:` links to avoid `javascript:` / `data:` injection.
 */
function isSafeHref(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return true;
  return false;
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; label: string; href: string };

/**
 * Parse a single line into typed segments.
 *
 * Supports:
 * - `**bold**`
 * - `*italic*`
 * - `` `code` ``
 * - `[label](url)`
 *
 * The regex picks whichever token starts earliest. Anything that can't be
 * parsed as a token (or whose URL is unsafe) falls through as plain text.
 */
function parseInline(line: string): Segment[] {
  const out: Segment[] = [];
  let remaining = line;

  // Ordered: link → code → bold → italic.
  const patterns: Array<{
    kind: 'link' | 'code' | 'bold' | 'italic';
    re: RegExp;
  }> = [
    { kind: 'link',   re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
    { kind: 'code',   re: /`([^`\n]+)`/ },
    { kind: 'bold',   re: /\*\*([^*\n]+)\*\*/ },
    { kind: 'italic', re: /\*([^*\n]+)\*/ },
  ];

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestMatch: RegExpExecArray | null = null;
    let bestKind: Segment['kind'] = 'text';

    for (const { kind, re } of patterns) {
      const m = re.exec(remaining);
      if (m && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestMatch = m;
        bestKind = kind;
      }
    }

    if (!bestMatch) {
      out.push({ kind: 'text', value: remaining });
      break;
    }

    if (bestIdx > 0) {
      out.push({ kind: 'text', value: remaining.slice(0, bestIdx) });
    }

    if (bestKind === 'link') {
      const label = bestMatch[1];
      const href = bestMatch[2];
      if (isSafeHref(href)) {
        out.push({ kind: 'link', label, href });
      } else {
        // Unsafe scheme — render the match literally.
        out.push({ kind: 'text', value: bestMatch[0] });
      }
    } else if (bestKind === 'code') {
      out.push({ kind: 'code', value: bestMatch[1] });
    } else if (bestKind === 'bold') {
      out.push({ kind: 'bold', value: bestMatch[1] });
    } else if (bestKind === 'italic') {
      out.push({ kind: 'italic', value: bestMatch[1] });
    }

    remaining = remaining.slice(bestIdx + bestMatch[0].length);
  }

  return out;
}

function renderSegments(
  segments: Segment[],
  linkColor: string,
  keyPrefix: string,
): ReactNode[] {
  return segments.map((seg, i) => {
    const k = `${keyPrefix}-${i}`;
    switch (seg.kind) {
      case 'bold':
        return <strong key={k} className="font-semibold">{seg.value}</strong>;
      case 'italic':
        return <em key={k} className="italic">{seg.value}</em>;
      case 'code':
        return (
          <code
            key={k}
            className="rounded px-1 py-0.5 font-mono text-[12px]"
            style={{ backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' }}
          >
            {seg.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={k}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline"
            style={{ color: linkColor }}
          >
            {seg.label}
          </a>
        );
      case 'text':
      default:
        return <Fragment key={k}>{seg.value}</Fragment>;
    }
  });
}

/* ── Component ─────────────────────────────────────────────────────────── */

/**
 * Text bubble with:
 * - `{{variable}}` token resolution,
 * - markdown-ish formatting (`**bold**`, `*italic*`, `` `code` ``, `[label](url)`),
 * - newline preservation.
 *
 * Links open in a new tab and only accept `http(s)`, `mailto:`, `tel:` schemes.
 */
export function TextBubble({
  text,
  variant,
  variables,
  backgroundColor,
  color,
  linkColor,
}: TextBubbleProps) {
  const resolved = useMemo(
    () => substituteTokens(text ?? '', variables),
    [text, variables],
  );

  // Split on newlines and render each line as its own row.
  const lines = useMemo(() => resolved.split(/\r?\n/), [resolved]);

  const effectiveLinkColor =
    linkColor ?? (variant === 'user' ? 'inherit' : 'var(--orange-9)');

  return (
    <ChatBubble
      variant={variant}
      backgroundColor={backgroundColor}
      color={color}
    >
      {lines.map((line, i) => {
        const segments = parseInline(line);
        const rendered = renderSegments(segments, effectiveLinkColor, `l${i}`);
        return (
          <Fragment key={i}>
            {line.length === 0 ? <br /> : rendered}
            {i < lines.length - 1 && <br />}
          </Fragment>
        );
      })}
    </ChatBubble>
  );
}
