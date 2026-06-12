"use client";

/**
 * Function browser — a searchable, category-grouped modal (ribbon: Formulas → Σ Insert function).
 * Inserting puts `=NAME(` into the formula bar via the workbench.
 */
import { useMemo, useState } from "react";
import { FUNCTION_META, FUNCTION_CATEGORIES } from "./function-catalog.ts";

export interface FunctionBrowserProps {
  /** Engine-accepted names (authoritative; functions without metadata land under "Other"). */
  names: string[];
  onInsert: (name: string) => void;
  onClose: () => void;
}

export function FunctionBrowser({ names, onInsert, onClose }: FunctionBrowserProps) {
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    const needle = q.trim().toUpperCase();
    for (const name of names) {
      if (needle && !name.includes(needle) && !(FUNCTION_META[name]?.desc.toUpperCase().includes(needle) ?? false)) {
        continue;
      }
      const cat = FUNCTION_META[name]?.cat ?? "Other";
      const list = map.get(cat) ?? [];
      list.push(name);
      map.set(cat, list);
    }
    return map;
  }, [names, q]);

  return (
    <div style={scrim} onClick={onClose} role="presentation">
      <style>{CSS}</style>
      <div className="sbfb" role="dialog" aria-label="Insert function" onClick={(e) => e.stopPropagation()}>
        <div className="sbfb-head">
          <strong>Insert function</strong>
          <button className="sbfb-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <input
          autoFocus
          className="sbfb-search"
          placeholder={`Search ${names.length} functions…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className="sbfb-body">
          {FUNCTION_CATEGORIES.filter((c) => grouped.has(c)).map((cat) => (
            <div key={cat}>
              <div className="sbfb-cat">{cat}</div>
              {grouped.get(cat)!.map((name) => {
                const m = FUNCTION_META[name];
                return (
                  <button key={name} className="sbfb-fn" onClick={() => onInsert(name)} title={m?.sig ?? name}>
                    <span className="sbfb-name">{m?.sig ?? `${name}(…)`}</span>
                    {m && <span className="sbfb-desc">{m.desc}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {grouped.size === 0 && <div className="sbfb-empty">No functions match “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}

const scrim: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(32,33,36,.4)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: "8vh",
};

const CSS = `
.sbfb {
  width: 560px; max-height: 72vh; display: flex; flex-direction: column;
  background: #fff; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.28);
  font: 13px -apple-system, system-ui, sans-serif; overflow: hidden;
}
.sbfb-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 8px; }
.sbfb-x { border: none; background: none; cursor: pointer; color: #5f6368; font-size: 14px; }
.sbfb-search {
  margin: 0 18px 10px; height: 36px; border: 1px solid #c4c7c5; border-radius: 8px;
  padding: 0 12px; font: 13px -apple-system, system-ui, sans-serif;
}
.sbfb-search:focus { outline: 2px solid #1a73e8; outline-offset: -1px; border-color: transparent; }
.sbfb-body { overflow-y: auto; padding: 0 10px 14px; }
.sbfb-cat {
  font-size: 11px; color: #9aa0a6; text-transform: uppercase; letter-spacing: .4px;
  padding: 12px 10px 4px;
}
.sbfb-fn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%;
  border: none; background: transparent; text-align: left; padding: 7px 10px; border-radius: 8px;
  cursor: pointer; font: 13px -apple-system, system-ui, sans-serif;
}
@media (hover: hover) and (pointer: fine) { .sbfb-fn:hover { background: #e8f0fe; } }
.sbfb-fn:focus-visible { outline: 2px solid #1a73e8; outline-offset: -2px; }
.sbfb-name { font-weight: 600; color: #1f1f1f; }
.sbfb-desc { color: #5f6368; font-size: 12px; }
.sbfb-empty { padding: 24px; text-align: center; color: #5f6368; }
`;
