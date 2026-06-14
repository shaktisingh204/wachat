"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, ArrowRight, Loader2 } from "lucide-react";

import {
  completeSabsignSetup,
  type SabsignSetupState,
} from "@/app/actions/sabsign-projects.actions";

export function SetupClient({ state }: { state: SabsignSetupState }) {
  const router = useRouter();
  const [businessName, setBusinessName] = React.useState(state.businessName ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFinish() {
    setBusy(true);
    setError(null);
    const res = await completeSabsignSetup(state.projectId, {
      businessName: businessName.trim() || undefined,
    });
    if (!res.success) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.replace("/sabsign");
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-16">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--st-accent,#7c3aed)]/10 text-[var(--st-accent,#7c3aed)]">
          <FileSignature className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">
            Finish setting up “{state.name}”
          </h1>
          <p className="text-sm text-[var(--st-text-secondary,#666)]">
            One step and you’re ready to send documents for signature.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <label className="mb-2 block text-sm font-medium text-[var(--st-text,#111)]">
        Business / sender name{" "}
        <span className="font-normal text-[var(--st-text-secondary,#999)]">
          (optional — shown to signers &amp; on the audit trail)
        </span>
      </label>
      <input
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Acme Inc."
        maxLength={120}
        className="mb-6 w-full rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] px-3 py-2.5 text-sm text-[var(--st-text,#111)] outline-none focus:border-[var(--st-accent,#7c3aed)]"
      />

      <button
        type="button"
        onClick={handleFinish}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--st-accent,#7c3aed)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        Finish &amp; open SabSign
      </button>
    </div>
  );
}
