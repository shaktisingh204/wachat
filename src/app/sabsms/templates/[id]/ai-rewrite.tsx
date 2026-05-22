"use client";

import { useState, useTransition } from "react";
import { Sparkles, Languages, Scissors, Smile, MousePointerClick } from "lucide-react";

import {
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";

import {
  runAiRewrite,
  runTranslation,
  type AiRewriteMode,
} from "./actions";
import { SUPPORTED_LOCALES, type LocaleCode } from "./types";

/**
 * Feature #11 (rewrite shorter/friendlier/add CTA) + feature #12
 * (translate to target locale).
 *
 * The server actions return either real LLM output or, today, a
 * deterministic stub — see the TODO in `actions.ts#runAiRewrite`.
 */

export interface AiRewriteToolbarProps {
  /** Current locale body — what we send to the AI. */
  currentBody: string;
  /** Caller replaces the current locale body with the rewrite. */
  onApply: (next: string) => void;
  /** Caller writes the translation under `targetLocale`. */
  onApplyTranslation: (locale: LocaleCode, body: string) => void;
}

interface BusyState {
  mode: AiRewriteMode | null;
  error?: string;
  note?: string;
}

export function AiRewriteToolbar({
  currentBody,
  onApply,
  onApplyTranslation,
}: AiRewriteToolbarProps) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<BusyState>({ mode: null });
  const [target, setTarget] = useState<LocaleCode>("hi");

  function runMode(mode: AiRewriteMode) {
    setBusy({ mode });
    startTransition(async () => {
      const res = await runAiRewrite({ body: currentBody, mode });
      if (!res.ok) {
        setBusy({ mode: null, error: res.error });
        return;
      }
      onApply(res.body);
      setBusy({ mode: null, note: res.note });
    });
  }

  function runTranslate() {
    setBusy({ mode: "translate" });
    startTransition(async () => {
      const res = await runTranslation({ body: currentBody, targetLocale: target });
      if (!res.ok) {
        setBusy({ mode: null, error: res.error });
        return;
      }
      onApplyTranslation(target, res.body);
      setBusy({ mode: null, note: res.note });
    });
  }

  const disabled = pending || !currentBody.trim();

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <Sparkles className="h-3.5 w-3.5" />
        AI assistance
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => runMode("shorter")}
        >
          <Scissors className="mr-1.5 h-3.5 w-3.5" />
          {busy.mode === "shorter" && pending ? "Rewriting…" : "Rewrite shorter"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => runMode("friendlier")}
        >
          <Smile className="mr-1.5 h-3.5 w-3.5" />
          {busy.mode === "friendlier" && pending ? "Rewriting…" : "Make friendlier"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => runMode("add_cta")}
        >
          <MousePointerClick className="mr-1.5 h-3.5 w-3.5" />
          {busy.mode === "add_cta" && pending ? "Adding CTA…" : "Add CTA"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <div className="flex-1 min-w-[140px] space-y-1">
          <div className="text-[11px] font-medium text-slate-600">
            Translate to
          </div>
          <Select value={target} onValueChange={(v) => setTarget(v as LocaleCode)}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {SUPPORTED_LOCALES.map((l) => (
                <ZoruSelectItem key={l.code} value={l.code}>
                  {l.label} ({l.code})
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={runTranslate}
        >
          <Languages className="mr-1.5 h-3.5 w-3.5" />
          {busy.mode === "translate" && pending ? "Translating…" : "Translate"}
        </Button>
      </div>

      {busy.error && (
        <p className="text-xs text-rose-600">{busy.error}</p>
      )}
      {busy.note && (
        <p className="text-[11px] text-amber-700">{busy.note}</p>
      )}
    </div>
  );
}
