"use client";

/**
 * Worksheet tab strip (Excel-style). Lists the workbook's sheets, highlights the active one, supports
 * click-to-switch, double-click-to-rename, and a `+` to add a sheet. Hidden sheets are omitted. Drives
 * the grid through `SheetCanvasHandle`.
 */
import { useState } from "react";
import type { SheetInfo } from "../../../lib/sabsheet/engine/protocol.ts";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";

export interface SheetTabsProps {
  sheets: SheetInfo[];
  active: number;
  grid: React.RefObject<SheetCanvasHandle | null>;
}

export function SheetTabs({ sheets, active, grid }: SheetTabsProps) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = async (i: number) => {
    const name = draft.trim();
    if (name && name !== sheets[i]?.name) await grid.current?.renameSheet(i, name);
    setRenaming(null);
  };

  return (
    <div style={bar} role="tablist" aria-label="Worksheets">
      <button style={addBtn} title="Add sheet" aria-label="Add sheet" onClick={() => void grid.current?.addSheet()}>
        +
      </button>
      {sheets.map((s, i) =>
        s.state === "hidden" ? null : (
          <div
            key={`${i}-${s.name}`}
            role="tab"
            aria-selected={i === active}
            tabIndex={0}
            onClick={() => i !== active && void grid.current?.setActiveSheet(i)}
            onDoubleClick={() => {
              setRenaming(i);
              setDraft(s.name);
            }}
            style={{
              ...tab,
              ...(i === active ? tabActive : null),
              ...(s.color ? { borderBottom: `2px solid ${s.color}` } : null),
            }}
          >
            {renaming === i ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void commitRename(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename(i);
                  else if (e.key === "Escape") setRenaming(null);
                }}
                style={renameInput}
              />
            ) : (
              s.name
            )}
          </div>
        ),
      )}
    </div>
  );
}

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  height: 32,
  padding: "0 8px",
  borderTop: "1px solid #e1e3e6",
  background: "#f8f9fa",
  overflowX: "auto",
  font: "13px -apple-system, system-ui, sans-serif",
};
const addBtn: React.CSSProperties = {
  minWidth: 26,
  height: 24,
  border: "1px solid transparent",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
  color: "#5f6368",
  fontSize: 16,
};
const tab: React.CSSProperties = {
  height: 28,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  cursor: "pointer",
  color: "#5f6368",
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  whiteSpace: "nowrap",
};
const tabActive: React.CSSProperties = { background: "#fff", color: "#1a73e8", fontWeight: 600, boxShadow: "0 -1px 0 #e1e3e6 inset" };
const renameInput: React.CSSProperties = {
  width: 90,
  height: 20,
  border: "1px solid #1a73e8",
  borderRadius: 3,
  font: "13px -apple-system, system-ui, sans-serif",
  padding: "0 4px",
};
