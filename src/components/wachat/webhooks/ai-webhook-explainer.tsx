"use client";

/**
 * AiWebhookExplainer (Wave 9)
 *
 * Paste (or seed) a Meta WhatsApp webhook payload → Claude explains what
 * happened and whether it needs action (`aiExplainWebhook`), with a severity
 * tone. Self-contained; `initialPayload` lets the host seed the latest event.
 */

import * as React from "react";
import { Sparkles, Webhook } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiExplainWebhook } from "@/lib/wachat/ai/copilot-actions";
import type { WebhookExplainResult } from "@/lib/wachat/ai/types";

import { ProcessingDots } from "../motion";

const SEVERITY_TONE: Record<WebhookExplainResult["severity"], string> = {
  info: "var(--st-info, #34b7f1)",
  warning: "var(--st-warn, #f59e0b)",
  error: "var(--st-danger, #dc2626)",
};

export interface AiWebhookExplainerProps {
  initialPayload?: string;
  className?: string;
}

export function AiWebhookExplainer({ initialPayload = "", className }: AiWebhookExplainerProps) {
  const [payload, setPayload] = React.useState(initialPayload);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<WebhookExplainResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialPayload) setPayload(initialPayload);
  }, [initialPayload]);

  async function explain() {
    if (!payload.trim()) {
      setError("Paste a webhook payload to explain.");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiExplainWebhook({ payload });
    setLoading(false);
    if (r.ok) setResult(r);
    else setError(r.error ?? "Could not explain this payload.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Webhook size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">Explain a webhook event</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Claude decodes the payload for you</p>
        </div>
      </div>

      <Field label="Webhook payload (JSON)">
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={5}
          placeholder='{"entry":[{"changes":[{"field":"messages", ...}]}]}'
          className="font-mono text-xs"
        />
      </Field>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={explain}>
          Explain
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Decoding…
        </div>
      ) : null}

      {result && result.ok ? (
        <div
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{
            borderColor: `color-mix(in srgb, ${SEVERITY_TONE[result.severity]} 40%, transparent)`,
            background: `color-mix(in srgb, ${SEVERITY_TONE[result.severity]} 8%, transparent)`,
            color: "var(--st-text)",
          }}
        >
          <span className="mr-1.5 font-semibold capitalize" style={{ color: SEVERITY_TONE[result.severity] }}>
            {result.severity}:
          </span>
          {result.explanation}
        </div>
      ) : null}
    </Card>
  );
}

export default AiWebhookExplainer;
