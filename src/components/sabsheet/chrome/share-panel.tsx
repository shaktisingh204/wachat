"use client";

/**
 * Share panel: invite collaborators by email (they get edit access) and see the member list. Shared
 * users can then open the workbook, edit, and appear as live presence cursors. Owner-only controls.
 */
import { useCallback, useEffect, useState } from "react";
import {
  listWorkbookMembers,
  shareWorkbook,
  unshareWorkbook,
  type WorkbookMember,
} from "../../../app/actions/sabsheet-share.actions.ts";

export interface SharePanelProps {
  workbookId: string;
  onClose: () => void;
}

export function SharePanel({ workbookId, onClose }: SharePanelProps) {
  const [members, setMembers] = useState<WorkbookMember[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMembers(await listWorkbookMembers(workbookId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    }
  }, [workbookId]);

  useEffect(() => { void reload(); }, [reload]);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareWorkbook(workbookId, email);
      if ("error" in res) setError(res.error);
      else {
        setEmail("");
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  const isOwner = members.some((m) => m.role === "owner");

  return (
    <div style={panel}>
      <div style={head}>
        <strong>Share</strong>
        <button style={x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div style={body}>
        <div style={card}>
          <div style={sec}>Invite by email</div>
          <input
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void invite()}
            placeholder="person@example.com"
          />
          <button style={primary} onClick={() => void invite()} disabled={busy}>
            {busy ? "Inviting…" : "Invite as editor"}
          </button>
          {error && <div style={{ color: "#c5221f", fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>

        <div style={sec}>People ({members.length})</div>
        {members.map((m) => (
          <div key={m.userId} style={{ ...card, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
              <div style={{ fontSize: 11, color: "#5f6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
            </div>
            <span style={badge}>{m.role}</span>
            {isOwner && m.role === "editor" && (
              <button
                style={linkBtn}
                onClick={async () => { await unshareWorkbook(workbookId, m.userId); await reload(); }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const panel: React.CSSProperties = { width: 320, height: "100%", borderLeft: "1px solid #e1e3e6", background: "#fff", display: "flex", flexDirection: "column", font: FONT };
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #e1e3e6" };
const body: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 12 };
const card: React.CSSProperties = { border: "1px solid #e1e3e6", borderRadius: 8, padding: 12, marginBottom: 12 };
const sec: React.CSSProperties = { fontSize: 11, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 8px" };
const input: React.CSSProperties = { width: "100%", height: 32, border: "1px solid #e1e3e6", borderRadius: 4, font: FONT, padding: "0 8px", marginBottom: 8, boxSizing: "border-box" };
const primary: React.CSSProperties = { height: 32, padding: "0 16px", border: "none", borderRadius: 6, background: "#1a73e8", color: "#fff", font: FONT, cursor: "pointer" };
const linkBtn: React.CSSProperties = { color: "#1a73e8", background: "none", border: "none", padding: 0, cursor: "pointer", font: FONT };
const badge: React.CSSProperties = { fontSize: 11, color: "#5f6368", background: "#f1f3f4", borderRadius: 10, padding: "2px 8px" };
const x: React.CSSProperties = { border: "none", background: "none", cursor: "pointer", color: "#5f6368", fontSize: 14 };
