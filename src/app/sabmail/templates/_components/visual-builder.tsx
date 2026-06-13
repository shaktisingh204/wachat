"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/app/sabmail/_components/rich-text-editor";
import "@/components/sabmail/motion/sabmail-motion.css";

/**
 * Optional visual email-template builder.
 *
 * GrapesJS (and its newsletter preset) are NOT a hard dependency of this app —
 * keeping the bundle slim for the common case where the rich-text composer is
 * enough. We load them lazily through the optional-dep idiom (a non-literal
 * dynamic import that TypeScript won't try to resolve at compile-time) so this
 * file compiles cleanly with the packages ABSENT.
 *
 *   Enable the drag-and-drop builder with:
 *     npm i grapesjs grapesjs-preset-newsletter
 *
 * When GrapesJS isn't installed we degrade gracefully to the existing
 * {@link RichTextEditor}, wired to the same `onChange` contract.
 *
 * CSS note — GrapesJS ships its own stylesheet. We inject it from the CDN via a
 * dynamically-added <link> ONLY when the editor actually mounts (so we never
 * load CSS for a feature that isn't present). If you'd rather self-host, import
 * `grapesjs/dist/css/grapes.min.css` from a wrapper once the package is added.
 */

const GRAPESJS_CSS_HREF =
  "https://unpkg.com/grapesjs/dist/css/grapes.min.css";
const GRAPESJS_CSS_LINK_ID = "sabmail-grapesjs-css";

function ensureGrapesCss(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(
    GRAPESJS_CSS_LINK_ID,
  ) as HTMLLinkElement | null;
  if (existing) return existing;
  const link = document.createElement("link");
  link.id = GRAPESJS_CSS_LINK_ID;
  link.rel = "stylesheet";
  link.href = GRAPESJS_CSS_HREF;
  document.head.appendChild(link);
  return link;
}

export interface VisualBuilderProps {
  initialHtml?: string;
  onChange: (html: string) => void;
}

type BuilderState = "loading" | "grapesjs" | "fallback";

export function VisualBuilder({ initialHtml, onChange }: VisualBuilderProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  // Editor is typed `any` on purpose — GrapesJS may be absent at compile-time.
  const editorRef = React.useRef<any>(null);
  const [state, setState] = React.useState<BuilderState>("loading");

  // Keep the latest onChange without re-running the mount effect.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Optional-dep idiom: non-literal specifier so tsc/bundler don't resolve
      // it at compile-time, and a `.catch(() => null)` so a missing package
      // degrades instead of throwing.
      const g = (await import(/* webpackIgnore: true */ ("grapesjs" as string)).catch(
        () => null,
      )) as any;

      if (cancelled) return;

      if (!g) {
        setState("fallback");
        return;
      }

      // Newsletter preset is independently optional — load it if present.
      const presetMod = (await import(
        /* webpackIgnore: true */ ("grapesjs-preset-newsletter" as string)
      ).catch(() => null)) as any;

      if (cancelled) return;

      const grapesjs = (g.default ?? g) as any;
      const host = hostRef.current;
      if (!grapesjs || typeof grapesjs.init !== "function" || !host) {
        setState("fallback");
        return;
      }

      // Inject the GrapesJS stylesheet now that we know the editor will mount.
      ensureGrapesCss();

      const preset = presetMod ? (presetMod.default ?? presetMod) : null;

      let editor: any;
      try {
        editor = grapesjs.init({
          container: host,
          height: "560px",
          fromElement: false,
          storageManager: false,
          components: initialHtml ?? "",
          ...(preset
            ? {
                plugins: [preset],
                pluginsOpts: { [preset as any]: {} },
              }
            : {}),
        });
      } catch {
        setState("fallback");
        return;
      }

      if (cancelled) {
        try {
          editor.destroy();
        } catch {
          /* ignore */
        }
        return;
      }

      editorRef.current = editor;

      const emit = () => {
        try {
          onChangeRef.current(editor.getHtml() ?? "");
        } catch {
          /* editor may be mid-teardown */
        }
      };

      // GrapesJS fires a broad `update` on any component/style change.
      editor.on("update", emit);
      editor.on("component:update", emit);
      editor.on("style:update", emit);

      setState("grapesjs");
      // Seed the parent with the starting HTML once mounted.
      emit();
    })();

    return () => {
      cancelled = true;
      const editor = editorRef.current;
      editorRef.current = null;
      if (editor) {
        try {
          editor.destroy();
        } catch {
          /* ignore */
        }
      }
    };
    // initialHtml is a one-time seed — re-running would blow away edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* GrapesJS mount target — kept in the tree so the ref is stable. */}
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)]",
          state === "grapesjs" ? "block" : "hidden",
        )}
      >
        <div ref={hostRef} className="sabmail-visual-builder min-h-[560px]" />
      </div>

      {state === "loading" ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-6 text-sm text-[var(--st-text-secondary)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading the visual builder…
        </div>
      ) : null}

      {state === "fallback" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-xs text-[var(--st-text-secondary)]">
            <Sparkles
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--st-accent)]"
              aria-hidden
            />
            <span>
              Visual builder needs the grapesjs package (
              <code className="font-mono text-[var(--st-text)]">
                npm i grapesjs grapesjs-preset-newsletter
              </code>
              ). Using the rich-text editor instead.
            </span>
          </div>
          <RichTextEditor
            initialHtml={initialHtml}
            onChange={onChange}
            ariaLabel="Email template body"
            placeholder="Design your email template…"
          />
        </div>
      ) : null}
    </div>
  );
}

export default VisualBuilder;
