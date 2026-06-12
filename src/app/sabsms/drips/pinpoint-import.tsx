"use client";

/**
 * "Import from Pinpoint" — drips-page dialog (V2.9).
 *
 * Accepts the AWS Pinpoint journey export JSON either as a picked
 * `.json` file (read client-side as text) or pasted into a textarea —
 * this is CONFIG, not media, so it deliberately doesn't go through
 * SabFiles. The server action maps activities → steps, creates template
 * drafts for every SMS activity, and returns warnings for everything
 * that needed a placeholder.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, FileJson, TriangleAlert } from "lucide-react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@/components/sabcrm/20ui";

import { importPinpointJourneyAction, type PinpointImportSummary } from "./actions";

export function PinpointImportButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [json, setJson] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<PinpointImportSummary | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setJson("");
    setError(null);
    setSummary(null);
    setBusy(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setJson(await file.text());
    } catch {
      setError("Could not read that file.");
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError(null);
    const res = await importPinpointJourneyAction(json);
    setBusy(false);
    if (res.ok) {
      setSummary(res.summary);
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}>
        <CloudDownload className="mr-1.5 h-4 w-4" />
        Import from Pinpoint
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import an AWS Pinpoint journey</DialogTitle>
            <DialogDescription>
              Pinpoint journeys reach end-of-life on Oct 30 2026. Export the journey JSON
              (Console → Journeys → ⋮ → Export, or <code>aws pinpoint get-journey</code>) and
              drop it here — SMS steps, waits, and attribute splits map automatically; the
              journey lands as a draft for review.
            </DialogDescription>
          </DialogHeader>

          {summary === null ? (
            <div className="space-y-3 py-1">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileJson className="mr-1.5 h-4 w-4" />
                  Pick a .json export
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pinpoint-json">…or paste the export JSON</Label>
                <Textarea
                  id="pinpoint-json"
                  rows={10}
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder='{"Name":"Welcome Series","StartActivity":"…","Activities":{…}}'
                  className="font-mono text-xs"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--st-danger,#b91c1c)]" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{summary.stepCount} steps</Badge>
                <Badge variant="secondary">{summary.templatesCreated} template drafts</Badge>
                <Badge variant="outline">draft</Badge>
              </div>
              <p className="text-sm text-[var(--st-text)]">
                “{summary.journeyName}” imported. Review the steps — especially imported
                template bodies — then activate.
              </p>
              {summary.warnings.length > 0 && (
                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-2.5">
                  {summary.warnings.map((w, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-[var(--st-text)]">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {summary === null ? (
              <>
                <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>
                  Cancel
                </Button>
                <Button disabled={busy || !json.trim()} onClick={() => void runImport()}>
                  {busy ? "Importing…" : "Import journey"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    router.push(`/sabsms/drips/${summary.journeyId}`);
                  }}
                >
                  Open the draft
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
