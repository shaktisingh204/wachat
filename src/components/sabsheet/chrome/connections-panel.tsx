"use client";

/**
 * SabSheet v2 — Live data connections side panel (Superpower C).
 *
 * Lists the workbook's connections and offers an add form (type + per-type
 * config + schedule + anchor). Each row exposes Refresh-now / pause-resume /
 * delete, all driven by the `sabsheet-connections` server actions. Styling is
 * inline to match `chrome/ribbon.tsx` (system font, #e1e3e6 borders, Google-
 * sheets palette) so it sits flush with the rest of the chrome.
 */

import { useEffect, useState, useTransition } from "react";

import {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  runConnectionNow,
} from "@/app/actions/sabsheet-connections.actions";
import { listSabsheetSheets } from "@/app/actions/sabsheet.actions";
import type {
  SabsheetConnection,
  SabsheetConnectionType,
  CreateSabsheetConnectionInput,
} from "@/lib/sabsheet/connections/types";

export interface ConnectionsPanelProps {
  workbookId: string;
  onClose: () => void;
}

interface SheetOption {
  _id: string;
  name: string;
}

const TYPE_LABEL: Record<SabsheetConnectionType, string> = {
  sabcrm: "SabCRM records",
  rest: "REST / JSON API",
  csv: "CSV (paste)",
};

export function ConnectionsPanel({ workbookId, onClose }: ConnectionsPanelProps) {
  const [connections, setConnections] = useState<SabsheetConnection[]>([]);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Add-form state
  const [type, setType] = useState<SabsheetConnectionType>("sabcrm");
  const [sheetId, setSheetId] = useState<string>("");
  const [anchorRow, setAnchorRow] = useState("1");
  const [anchorCol, setAnchorCol] = useState("1");
  const [intervalMode, setIntervalMode] = useState(false);
  const [everyMinutes, setEveryMinutes] = useState("60");
  const [secret, setSecret] = useState("");
  // sabcrm
  const [crmProjectId, setCrmProjectId] = useState("");
  const [crmObject, setCrmObject] = useState("");
  const [crmFields, setCrmFields] = useState("");
  // rest
  const [restUrl, setRestUrl] = useState("");
  const [restRowsPath, setRestRowsPath] = useState("");
  const [restColumns, setRestColumns] = useState("");
  // csv
  const [csvText, setCsvText] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const [conns, shs] = await Promise.all([
        listConnections(workbookId),
        listSabsheetSheets(workbookId),
      ]);
      setConnections(conns);
      setSheets(shs.map((s) => ({ _id: s._id, name: s.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookId]);

  function resetForm() {
    setType("sabcrm");
    setSheetId("");
    setAnchorRow("1");
    setAnchorCol("1");
    setIntervalMode(false);
    setEveryMinutes("60");
    setSecret("");
    setCrmProjectId("");
    setCrmObject("");
    setCrmFields("");
    setRestUrl("");
    setRestRowsPath("");
    setRestColumns("");
    setCsvText("");
  }

  function buildConfig(): CreateSabsheetConnectionInput["config"] {
    const fields = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    if (type === "sabcrm") {
      return { projectId: crmProjectId.trim(), object: crmObject.trim(), fields: fields(crmFields) };
    }
    if (type === "rest") {
      return { url: restUrl.trim(), rowsPath: restRowsPath.trim() || undefined, columns: fields(restColumns) };
    }
    return { csv: csvText };
  }

  async function onAdd() {
    setError(null);
    const input: CreateSabsheetConnectionInput = {
      workbookId,
      sheetId: sheetId || undefined,
      type,
      config: buildConfig(),
      target: { anchorRow: Number(anchorRow) || 1, anchorCol: Number(anchorCol) || 1 },
      schedule: intervalMode
        ? { mode: "interval", everyMinutes: Number(everyMinutes) || 60 }
        : { mode: "manual" },
      secret: secret || undefined,
    };
    startTransition(async () => {
      try {
        await createConnection(input);
        resetForm();
        setShowForm(false);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create connection");
      }
    });
  }

  async function onRun(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await runConnectionNow(id);
      if (!res.ok && res.error) setError(res.error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onTogglePause(c: SabsheetConnection) {
    setBusyId(c._id);
    try {
      await updateConnection(c._id, { status: c.status === "active" ? "paused" : "active" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      await deleteConnection(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside style={panel} aria-label="Live data connections">
      <header style={headerRow}>
        <span style={headerTitle}>Live data connections</span>
        <button title="Close" onClick={onClose} style={iconBtn}>
          ✕
        </button>
      </header>

      {error && <div style={errorBar}>{error}</div>}

      <div style={body}>
        {loading ? (
          <div style={hint}>Loading…</div>
        ) : connections.length === 0 ? (
          <div style={hint}>No connections yet. Add one to pull live data into this sheet.</div>
        ) : (
          connections.map((c) => (
            <div key={c._id} style={card}>
              <div style={cardHead}>
                <span style={badge}>{TYPE_LABEL[c.type]}</span>
                <span style={{ ...statusDot, color: c.status === "active" ? "#188038" : "#9aa0a6" }}>
                  {c.status === "active" ? "● active" : "❚❚ paused"}
                </span>
              </div>
              <div style={meta}>
                Anchor R{c.target.anchorRow}/C{c.target.anchorCol}
                {" · "}
                {c.schedule.mode === "interval"
                  ? `every ${c.schedule.everyMinutes ?? 60}m`
                  : "manual"}
              </div>
              <div style={meta}>
                {c.lastRunAt
                  ? `Last run ${new Date(c.lastRunAt).toLocaleString()} · ${
                      c.lastStatus === "error" ? "error" : `${c.rowCount ?? 0} rows`
                    }`
                  : "Never run"}
              </div>
              {c.lastStatus === "error" && c.lastError && (
                <div style={errLine}>{c.lastError}</div>
              )}
              <div style={cardActions}>
                <button
                  style={smallBtn}
                  disabled={busyId === c._id}
                  onClick={() => void onRun(c._id)}
                  title="Poll the source and write rows now"
                >
                  {busyId === c._id ? "Refreshing…" : "↻ Refresh now"}
                </button>
                <button
                  style={smallBtn}
                  disabled={busyId === c._id}
                  onClick={() => void onTogglePause(c)}
                  title={c.status === "active" ? "Pause auto-refresh" : "Resume"}
                >
                  {c.status === "active" ? "Pause" : "Resume"}
                </button>
                <button
                  style={{ ...smallBtn, color: "#d93025" }}
                  disabled={busyId === c._id}
                  onClick={() => void onDelete(c._id)}
                  title="Delete connection"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}

        {showForm ? (
          <div style={form}>
            <label style={fieldLabel}>Source type</label>
            <select
              style={input}
              value={type}
              onChange={(e) => setType(e.target.value as SabsheetConnectionType)}
            >
              {(Object.keys(TYPE_LABEL) as SabsheetConnectionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>

            {type === "sabcrm" && (
              <>
                <label style={fieldLabel}>CRM project id</label>
                <input style={input} value={crmProjectId} onChange={(e) => setCrmProjectId(e.target.value)} placeholder="projectId" />
                <label style={fieldLabel}>Object slug</label>
                <input style={input} value={crmObject} onChange={(e) => setCrmObject(e.target.value)} placeholder="people, companies, leads…" />
                <label style={fieldLabel}>Fields (comma-separated, optional)</label>
                <input style={input} value={crmFields} onChange={(e) => setCrmFields(e.target.value)} placeholder="name,email,stage" />
              </>
            )}

            {type === "rest" && (
              <>
                <label style={fieldLabel}>URL</label>
                <input style={input} value={restUrl} onChange={(e) => setRestUrl(e.target.value)} placeholder="https://api.example.com/v1/items" />
                <label style={fieldLabel}>Rows path (dot-path to array, optional)</label>
                <input style={input} value={restRowsPath} onChange={(e) => setRestRowsPath(e.target.value)} placeholder="data.items" />
                <label style={fieldLabel}>Columns (comma-separated, optional)</label>
                <input style={input} value={restColumns} onChange={(e) => setRestColumns(e.target.value)} placeholder="id,name,amount" />
                <label style={fieldLabel}>Bearer token / API key (optional)</label>
                <input style={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="stored encrypted" />
              </>
            )}

            {type === "csv" && (
              <>
                <label style={fieldLabel}>CSV text</label>
                <textarea
                  style={{ ...input, height: 96, resize: "vertical", fontFamily: "monospace" }}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={"col1,col2\nval1,val2"}
                />
              </>
            )}

            <label style={fieldLabel}>Target sheet</label>
            <select style={input} value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
              <option value="">First sheet</option>
              {sheets.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Anchor row</label>
                <input style={input} value={anchorRow} onChange={(e) => setAnchorRow(e.target.value)} inputMode="numeric" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Anchor col</label>
                <input style={input} value={anchorCol} onChange={(e) => setAnchorCol(e.target.value)} inputMode="numeric" />
              </div>
            </div>

            <label style={{ ...fieldLabel, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={intervalMode} onChange={(e) => setIntervalMode(e.target.checked)} />
              Auto-refresh on a schedule
            </label>
            {intervalMode && (
              <>
                <label style={fieldLabel}>Every (minutes)</label>
                <input style={input} value={everyMinutes} onChange={(e) => setEveryMinutes(e.target.value)} inputMode="numeric" />
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={primaryBtn} onClick={() => void onAdd()}>
                Add connection
              </button>
              <button
                style={smallBtn}
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button style={primaryBtn} onClick={() => setShowForm(true)}>
            ＋ Add connection
          </button>
        )}
      </div>
    </aside>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const panel: React.CSSProperties = {
  width: 340,
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  borderLeft: "1px solid #e1e3e6",
  font: FONT,
  height: "100%",
  overflow: "hidden",
};
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid #f1f3f4",
};
const headerTitle: React.CSSProperties = { fontWeight: 600, color: "#202124" };
const iconBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#5f6368",
  fontSize: 14,
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const hint: React.CSSProperties = { fontSize: 12, color: "#5f6368" };
const errorBar: React.CSSProperties = {
  background: "#fce8e6",
  color: "#d93025",
  fontSize: 12,
  padding: "8px 12px",
  borderBottom: "1px solid #f1f3f4",
};
const card: React.CSSProperties = {
  border: "1px solid #e1e3e6",
  borderRadius: 8,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const badge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#1a73e8",
  background: "#e8f0fe",
  borderRadius: 4,
  padding: "2px 6px",
};
const statusDot: React.CSSProperties = { fontSize: 11 };
const meta: React.CSSProperties = { fontSize: 11, color: "#5f6368" };
const errLine: React.CSSProperties = { fontSize: 11, color: "#d93025", wordBreak: "break-word" };
const cardActions: React.CSSProperties = { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" };
const smallBtn: React.CSSProperties = {
  border: "1px solid #e1e3e6",
  background: "#fff",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  cursor: "pointer",
  color: "#202124",
};
const primaryBtn: React.CSSProperties = {
  border: "none",
  background: "#1a73e8",
  color: "#fff",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const form: React.CSSProperties = {
  border: "1px solid #e1e3e6",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const fieldLabel: React.CSSProperties = { fontSize: 11, color: "#5f6368", marginTop: 4 };
const input: React.CSSProperties = {
  height: 30,
  border: "1px solid #e1e3e6",
  borderRadius: 4,
  font: FONT,
  padding: "0 8px",
  width: "100%",
  boxSizing: "border-box",
};
