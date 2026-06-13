"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline,
} from "lucide-react";

import { cn } from "@/lib/utils";
import "@/components/sabmail/motion/sabmail-motion.css";

/**
 * Dependency-free rich-text editor (contentEditable + a slim toolbar).
 *
 * `@tiptap/react` isn't installed in this app (only `@tiptap/core`), so the
 * composer uses the browser's built-in editing via `document.execCommand`.
 * It's deprecated but universally supported and perfect for an email body.
 * Output HTML is always re-sanitized server-side before sending.
 */
export interface RichTextEditorHandle {
  setHtml: (html: string) => void;
  focus: () => void;
}

export const RichTextEditor = React.forwardRef<
  RichTextEditorHandle,
  {
    initialHtml?: string;
    onChange?: (html: string) => void;
    placeholder?: string;
    className?: string;
    ariaLabel?: string;
  }
>(function RichTextEditor(
  { initialHtml, onChange, placeholder = "Write your message…", className, ariaLabel = "Message body" },
  fwdRef,
) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Seed the initial HTML once (uncontrolled afterwards, so the caret never jumps).
  React.useEffect(() => {
    if (ref.current && initialHtml != null) {
      ref.current.innerHTML = initialHtml;
      onChange?.(initialHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = React.useCallback(() => {
    onChange?.(ref.current?.innerHTML ?? "");
  }, [onChange]);

  React.useImperativeHandle(
    fwdRef,
    () => ({
      setHtml: (html: string) => {
        if (ref.current) {
          ref.current.innerHTML = html;
          emit();
        }
      },
      focus: () => ref.current?.focus(),
    }),
    [emit],
  );

  const exec = React.useCallback(
    (command: string, value?: string) => {
      ref.current?.focus();
      try {
        document.execCommand(command, false, value);
      } catch {
        /* unsupported command — ignore */
      }
      emit();
    },
    [emit],
  );

  const addLink = React.useCallback(() => {
    const url = window.prompt("Link URL", "https://");
    if (url && /^https?:\/\//i.test(url)) exec("createLink", url);
  }, [exec]);

  const tools: Array<{ icon: React.ElementType; label: string; run: () => void }> = [
    { icon: Bold, label: "Bold", run: () => exec("bold") },
    { icon: Italic, label: "Italic", run: () => exec("italic") },
    { icon: Underline, label: "Underline", run: () => exec("underline") },
    { icon: List, label: "Bulleted list", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => exec("insertOrderedList") },
    { icon: Quote, label: "Quote", run: () => exec("formatBlock", "blockquote") },
    { icon: Link2, label: "Link", run: addLink },
  ];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--st-border)] pb-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              // Keep editor selection while clicking the toolbar.
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          );
        })}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        className="sabmail-editor mt-3 max-h-[40vh] min-h-[180px] overflow-y-auto text-sm leading-relaxed text-[var(--st-text)]"
      />
    </div>
  );
});
