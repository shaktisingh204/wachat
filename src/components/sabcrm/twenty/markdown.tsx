'use client';

/**
 * SabCRM — dependency-free Markdown renderer (Twenty-faithful).
 *
 * Twenty's `LazyMarkdownRenderer` leans on `react-markdown` + `remark-gfm`.
 * SabCRM's AI surface streams plain text and we must NOT pull a new npm
 * dependency, so this is a small, self-contained Markdown-to-React renderer
 * covering the subset that LLM replies actually use:
 *
 *   - ATX headings        `# … ######`
 *   - **bold** / __bold__
 *   - *italic* / _italic_
 *   - `inline code`
 *   - fenced ```code blocks``` (with optional language label)
 *   - unordered lists  (`-`, `*`, `+`)  and ordered lists (`1.`)
 *   - blockquotes       (`> …`)
 *   - horizontal rules  (`---`, `***`, `___`)
 *   - [links](https://…)  — http/https/mailto only, opened in a new tab
 *
 * Safety: we NEVER use `dangerouslySetInnerHTML`. Every node is a real React
 * element, so the input cannot inject markup or scripts. Link hrefs are passed
 * through {@link safeHref}, which drops `javascript:` / `data:` and other
 * non-allowlisted schemes. The output is styled by the caller via `.st-md`
 * classes (see `ai.css` for the AI page's rules).
 *
 * This is intentionally a line/inline parser rather than a full CommonMark
 * engine — it is robust against partial/streaming input (it renders whatever
 * has arrived so far) and small enough to read in one sitting.
 */

import * as React from 'react';

// ---------------------------------------------------------------------------
// Inline parsing — bold / italic / code / links
// ---------------------------------------------------------------------------

/** Allow only safe, user-facing link schemes; otherwise render as plain text. */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.length === 0) return null;
  // Relative / anchor links are fine.
  if (href.startsWith('/') || href.startsWith('#')) return href;
  try {
    const url = new URL(href);
    const scheme = url.protocol.toLowerCase();
    if (scheme === 'http:' || scheme === 'https:' || scheme === 'mailto:') {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses the inline grammar of a single text run into React nodes. Handles
 * (in precedence order) inline code, links, bold, then italic. Anything that
 * doesn't match is emitted verbatim, so malformed markup degrades to plain
 * text rather than disappearing.
 */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let cursor = 0;

  // Ordered so earlier patterns win: code first (its contents are literal),
  // then links, then strong (** / __), then emphasis (* / _).
  const patterns: Array<{
    re: RegExp;
    render: (m: RegExpExecArray, key: string) => React.ReactNode;
  }> = [
    {
      re: /`([^`]+)`/,
      render: (m, key) => (
        <code key={key} className="st-md__code">
          {m[1]}
        </code>
      ),
    },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      render: (m, key) => {
        const href = safeHref(m[2]);
        const label = parseInline(m[1], `${key}-l`);
        if (!href) return <React.Fragment key={key}>{label}</React.Fragment>;
        return (
          <a
            key={key}
            href={href}
            className="st-md__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        );
      },
    },
    {
      re: /\*\*([^*]+)\*\*|__([^_]+)__/,
      render: (m, key) => (
        <strong key={key} className="st-md__strong">
          {parseInline(m[1] ?? m[2] ?? '', `${key}-b`)}
        </strong>
      ),
    },
    {
      re: /\*([^*]+)\*|_([^_]+)_/,
      render: (m, key) => (
        <em key={key} className="st-md__em">
          {parseInline(m[1] ?? m[2] ?? '', `${key}-i`)}
        </em>
      ),
    },
  ];

  // Walk the string, repeatedly finding the earliest-matching pattern.
  while (remaining.length > 0) {
    let best: { index: number; length: number; node: React.ReactNode } | null =
      null;

    for (const { re, render } of patterns) {
      const m = re.exec(remaining);
      if (m && (best === null || m.index < best.index)) {
        best = {
          index: m.index,
          length: m[0].length,
          node: render(m, `${keyPrefix}-${cursor}`),
        };
      }
    }

    if (best === null) {
      nodes.push(remaining);
      break;
    }

    if (best.index > 0) {
      nodes.push(remaining.slice(0, best.index));
    }
    nodes.push(best.node);
    remaining = remaining.slice(best.index + best.length);
    cursor += 1;
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Block parsing — headings / lists / quotes / code fences / paragraphs
// ---------------------------------------------------------------------------

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^(\d+)\.\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE_RE = /^```(.*)$/;

function renderBlocks(source: string): React.ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines between blocks.
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block.
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const lang = fence[1].trim();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      // Consume the closing fence if present.
      if (i < lines.length) i += 1;
      blocks.push(
        <pre key={`pre-${key++}`} className="st-md__pre">
          {lang ? (
            <span className="st-md__pre-lang" aria-hidden="true">
              {lang}
            </span>
          ) : null}
          <code className="st-md__pre-code">{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule.
    if (HR_RE.test(line.trim())) {
      blocks.push(<hr key={`hr-${key++}`} className="st-md__hr" />);
      i += 1;
      continue;
    }

    // Heading.
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = parseInline(heading[2], `h-${key}`);
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <Tag key={`h-${key++}`} className={`st-md__h st-md__h${level}`}>
          {content}
        </Tag>,
      );
      i += 1;
      continue;
    }

    // Blockquote (consume consecutive `>` lines).
    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        buf.push(lines[i].replace(QUOTE_RE, '$1'));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${key++}`} className="st-md__quote">
          {renderBlocks(buf.join('\n'))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list (consume consecutive bullet lines).
    if (UL_RE.test(line)) {
      const items: React.ReactNode[] = [];
      let li = 0;
      while (i < lines.length && UL_RE.test(lines[i])) {
        const m = UL_RE.exec(lines[i]) as RegExpExecArray;
        items.push(
          <li key={`uli-${key}-${li}`} className="st-md__li">
            {parseInline(m[1], `uli-${key}-${li}`)}
          </li>,
        );
        li += 1;
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="st-md__ul">
          {items}
        </ul>,
      );
      continue;
    }

    // Ordered list (consume consecutive numbered lines).
    if (OL_RE.test(line)) {
      const items: React.ReactNode[] = [];
      let li = 0;
      const first = OL_RE.exec(line) as RegExpExecArray;
      const start = Number(first[1]);
      while (i < lines.length && OL_RE.test(lines[i])) {
        const m = OL_RE.exec(lines[i]) as RegExpExecArray;
        items.push(
          <li key={`oli-${key}-${li}`} className="st-md__li">
            {parseInline(m[2], `oli-${key}-${li}`)}
          </li>,
        );
        li += 1;
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${key++}`}
          className="st-md__ol"
          start={Number.isFinite(start) && start !== 1 ? start : undefined}
        >
          {items}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-block lines and join with
    // a soft break so wrapped prose flows naturally.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_RE.test(lines[i]) &&
      !HR_RE.test(lines[i].trim()) &&
      !HEADING_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${key++}`} className="st-md__p">
        {parseInline(para.join('\n'), `p-${key}`)}
      </p>,
    );
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface TwentyMarkdownProps {
  /** Raw Markdown source (may be partial/streaming). */
  children: string;
  /** Extra class on the wrapper (composed with `.st-md`). */
  className?: string;
}

/**
 * Renders Markdown `children` as sanitized React nodes under a `.st-md`
 * wrapper. Memoised on the source string so re-renders during streaming only
 * re-parse when the text actually changes.
 */
export function TwentyMarkdown({
  children,
  className,
}: TwentyMarkdownProps): React.JSX.Element {
  const content = React.useMemo(
    () => renderBlocks(children ?? ''),
    [children],
  );
  return (
    <div className={className ? `st-md ${className}` : 'st-md'}>{content}</div>
  );
}

export default TwentyMarkdown;
