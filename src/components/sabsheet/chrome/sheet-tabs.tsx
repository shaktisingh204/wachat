"use client";

/**
 * Worksheet tab strip, styled like Google Sheets' bottom bar: a light strip with a circular `+`
 * button and tabs where the active sheet is a white tab with a 3px blue underline. Click to switch,
 * double-click to rename. Hidden sheets are omitted. Drives the grid through `SheetCanvasHandle`.
 */
import { useState } from "react";
import type { SheetInfo } from "../../../lib/sabsheet/engine/protocol.ts";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";

export interface SheetTabsProps {
  sheets: SheetInfo[];
  active: number;
  grid: React.RefObject<SheetCanvasHandle | null>;
}

const CSS = `
.sbst {
  display: flex; align-items: stretch; gap: 2px; height: 36px; padding: 0 8px;
  border-top: 1px solid #e1e3e6; background: #f9fbfd; overflow-x: auto;
  font: 13px -apple-system, system-ui, sans-serif; scrollbar-width: none;
}
.sbst::-webkit-scrollbar { display: none; }
.sbst-add {
  align-self: center; width: 28px; height: 28px; flex: none;
  border: none; border-radius: 50%; background: transparent; color: #444746;
  font-size: 18px; line-height: 1; cursor: pointer;
  transition: background 100ms linear, transform 160ms cubic-bezier(.23,1,.32,1);
}
@media (hover: hover) and (pointer: fine) { .sbst-add:hover { background: rgba(68,71,70,.1); } }
.sbst-add:active { transform: scale(.94); }
.sbst-add:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
.sbst-tab {
  display: flex; align-items: center; padding: 0 16px; cursor: pointer; flex: none;
  color: #444746; border-bottom: 3px solid transparent; border-top: 3px solid transparent;
  white-space: nowrap; user-select: none; max-width: 200px;
  transition: background 100ms linear;
}
@media (hover: hover) and (pointer: fine) { .sbst-tab:hover { background: rgba(68,71,70,.06); } }
.sbst-tab[aria-selected="true"] {
  background: #fff; color: #0b57d0; font-weight: 600; border-bottom-color: #0b57d0;
}
.sbst-tab:focus-visible { outline: 2px solid #1a73e8; outline-offset: -2px; }
.sbst-rename {
  width: 96px; height: 22px; border: 1px solid #1a73e8; border-radius: 4px; padding: 0 6px;
  font: 13px -apple-system, system-ui, sans-serif;
}
`;

export function SheetTabs({ sheets, active, grid }: SheetTabsProps) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = async (i: number) => {
    const name = draft.trim();
    if (name && name !== sheets[i]?.name) await grid.current?.renameSheet(i, name);
    setRenaming(null);
  };

  return (
    <div className="sbst" role="tablist" aria-label="Worksheets">
      <style>{CSS}</style>
      <button className="sbst-add" title="Add sheet" aria-label="Add sheet" onClick={() => void grid.current?.addSheet()}>
        +
      </button>
      {sheets.map((s, i) =>
        s.state === "hidden" ? null : (
          <div
            key={`${i}-${s.name}`}
            role="tab"
            aria-selected={i === active}
            tabIndex={0}
            className="sbst-tab"
            onClick={() => i !== active && void grid.current?.setActiveSheet(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && i !== active) void grid.current?.setActiveSheet(i);
            }}
            onDoubleClick={() => {
              setRenaming(i);
              setDraft(s.name);
            }}
            style={s.color ? { borderBottomColor: s.color } : undefined}
          >
            {renaming === i ? (
              <input
                autoFocus
                className="sbst-rename"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void commitRename(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename(i);
                  else if (e.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
            )}
          </div>
        ),
      )}
    </div>
  );
}
