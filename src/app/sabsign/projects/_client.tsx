"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Plus, Check, Loader2 } from "lucide-react";

import {
  createSabsignProject,
  setActiveSabsignProject,
  type SabsignProjectRow,
} from "@/app/actions/sabsign-projects.actions";

export function ProjectsClient({
  initialProjects,
}: {
  initialProjects: SabsignProjectRow[];
}) {
  const router = useRouter();
  const [projects, setProjects] = React.useState(initialProjects);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    setError(null);
    const res = await createSabsignProject({ name: name.trim() });
    if (!res.success) {
      setError(res.error);
      setBusy(null);
      return;
    }
    const sel = await setActiveSabsignProject(res.projectId);
    if (!sel.success) {
      setError(sel.error);
      setBusy(null);
      return;
    }
    router.replace("/sabsign/setup");
  }

  async function handleSelect(p: SabsignProjectRow) {
    setBusy(p.id);
    setError(null);
    const sel = await setActiveSabsignProject(p.id);
    if (!sel.success) {
      setError(sel.error);
      setBusy(null);
      return;
    }
    router.replace(p.setupComplete ? "/sabsign" : "/sabsign/setup");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--st-accent,#7c3aed)]/10 text-[var(--st-accent,#7c3aed)]">
          <FileSignature className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">
            SabSign workspaces
          </h1>
          <p className="text-sm text-[var(--st-text-secondary,#666)]">
            Pick a signing workspace, or create one. Envelopes, templates and
            the audit trail are isolated per workspace.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <ul className="mb-8 flex flex-col gap-2">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => handleSelect(p)}
              disabled={!!busy}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] px-4 py-3 text-left transition hover:border-[var(--st-accent,#7c3aed)] disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <FileSignature className="h-4 w-4 text-[var(--st-text-secondary,#666)]" />
                <span className="font-medium text-[var(--st-text,#111)]">
                  {p.name}
                </span>
                {p.setupComplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    <Check className="h-3 w-3" /> Ready
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    Setup pending
                  </span>
                )}
              </span>
              {busy === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--st-text-secondary,#666)]" />
              ) : (
                <span className="text-sm text-[var(--st-accent,#7c3aed)]">Open</span>
              )}
            </button>
          </li>
        ))}
        {projects.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[var(--st-border,#e5e5e5)] px-4 py-6 text-center text-sm text-[var(--st-text-secondary,#666)]">
            No signing workspaces yet — create your first below.
          </li>
        ) : null}
      </ul>

      <form
        onSubmit={handleCreate}
        className="flex items-center gap-2 rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name (e.g. Sales agreements)"
          maxLength={120}
          className="flex-1 bg-transparent px-2 py-1.5 text-sm text-[var(--st-text,#111)] outline-none placeholder:text-[var(--st-text-secondary,#999)]"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy === "create"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--st-accent,#7c3aed)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create
        </button>
      </form>
    </div>
  );
}
