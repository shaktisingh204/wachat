"use client";

/**
 * Formula-bar assist UI: the autocomplete dropdown (while typing a function name) and the signature
 * strip (while the caret is inside a call). State (list, selection, accept) is owned by the
 * workbench; this renders it, anchored under the formula bar.
 */
import { FUNCTION_META } from "./function-catalog.ts";
import type { ActiveCall } from "./assist.ts";

export interface FormulaAssistProps {
  /** Filtered completion candidates (empty = no dropdown). */
  list: string[];
  selected: number;
  onPick: (name: string) => void;
  /** The call the caret is inside (signature help), if any. */
  call: ActiveCall | null;
}

export function FormulaAssist({ list, selected, onPick, call }: FormulaAssistProps) {
  const meta = call ? FUNCTION_META[call.name] : undefined;
  if (list.length === 0 && !meta) return null;

  return (
    <div style={wrap}>
      <style>{CSS}</style>
      {list.length > 0 ? (
        <ul className="sbfa-list" role="listbox" aria-label="Function suggestions">
          {list.map((name, i) => {
            const m = FUNCTION_META[name];
            return (
              <li
                key={name}
                role="option"
                aria-selected={i === selected}
                className={`sbfa-item${i === selected ? " sbfa-sel" : ""}`}
                // Mouse down (not click) so the input doesn't lose focus before accept.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(name);
                }}
              >
                <span className="sbfa-name">{name}</span>
                {m && <span className="sbfa-desc">{m.desc}</span>}
              </li>
            );
          })}
          <li className="sbfa-hint" aria-hidden>Tab or Enter to insert · Esc to dismiss</li>
        </ul>
      ) : meta && call ? (
        <div className="sbfa-sig" role="status">
          <SignatureLine sig={meta.sig} argIndex={call.argIndex} />
          <span className="sbfa-desc" style={{ marginLeft: 10 }}>{meta.desc}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Renders `NAME(arg1, [arg2], …)` with the active argument bolded. */
function SignatureLine({ sig, argIndex }: { sig: string; argIndex: number }) {
  const open = sig.indexOf("(");
  if (open < 0) return <span className="sbfa-name">{sig}</span>;
  const name = sig.slice(0, open);
  const inner = sig.slice(open + 1, sig.lastIndexOf(")"));
  const args = inner.split(",").map((s) => s.trim());
  return (
    <span>
      <span className="sbfa-name">{name}</span>(
      {args.map((a, i) => (
        <span key={i}>
          <span style={i === Math.min(argIndex, args.length - 1) ? { fontWeight: 700, color: "#0b57d0" } : undefined}>
            {a}
          </span>
          {i < args.length - 1 ? ", " : ""}
        </span>
      ))}
      )
    </span>
  );
}

const wrap: React.CSSProperties = { position: "relative" };

const CSS = `
.sbfa-list {
  position: absolute; left: 110px; top: 2px; z-index: 30; margin: 0; padding: 4px 0;
  list-style: none; min-width: 340px; max-width: 520px; background: #fff;
  border: 1px solid #dadce0; border-radius: 8px; box-shadow: 0 4px 16px rgba(60,64,67,.2);
  font: 13px -apple-system, system-ui, sans-serif;
}
.sbfa-item { display: flex; align-items: baseline; gap: 10px; padding: 6px 14px; cursor: pointer; }
.sbfa-item.sbfa-sel, .sbfa-item:hover { background: #e8f0fe; }
.sbfa-name { font-weight: 600; color: #1f1f1f; font-variant-numeric: tabular-nums; }
.sbfa-desc { color: #5f6368; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbfa-hint { padding: 4px 14px; font-size: 11px; color: #9aa0a6; border-top: 1px solid #f1f3f4; margin-top: 4px; }
.sbfa-sig {
  position: absolute; left: 110px; top: 2px; z-index: 30; display: flex; align-items: baseline;
  padding: 6px 14px; background: #fff; border: 1px solid #dadce0; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(60,64,67,.16); font: 12.5px -apple-system, system-ui, sans-serif;
  color: #1f1f1f; max-width: 640px;
}
`;
