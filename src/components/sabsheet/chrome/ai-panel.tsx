"use client";

/**
 * SabSheet AI side panel — "AI in cells" (Superpower B).
 *
 * Self-contained right-hand panel that drives the grid through `SheetCanvasHandle`.
 * Three sections:
 *   - "Generate formula": NL prompt → formula + explanation → Insert into active cell.
 *   - "Explain this formula": explains the current active cell's content.
 *   - "Ask": placeholder for the upcoming conversational mode.
 *
 * Inline styles only, matching the ribbon/toolbar aesthetic (light surface, system font).
 * A ribbon button should toggle this panel's mount; it is not wired here on purpose.
 */
import { useState } from "react";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";
import {
    generateFormulaAction,
    explainFormulaAction,
} from "../../../app/actions/sabsheet-ai.actions.ts";

export interface AiPanelProps {
    grid: React.RefObject<SheetCanvasHandle | null>;
    /** Current active cell content (formula or value), supplied by the workbench. */
    activeCellContent: string;
    onClose: () => void;
}

type Section = "generate" | "explain" | "ask";
const SECTIONS: { id: Section; label: string }[] = [
    { id: "generate", label: "Generate formula" },
    { id: "explain", label: "Explain" },
    { id: "ask", label: "Ask" },
];

export function AiPanel({ grid, activeCellContent, onClose }: AiPanelProps) {
    const [section, setSection] = useState<Section>("generate");

    // Generate-formula state.
    const [prompt, setPrompt] = useState("");
    const [genLoading, setGenLoading] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [formula, setFormula] = useState<string | null>(null);
    const [genExplanation, setGenExplanation] = useState<string | null>(null);

    // Explain state.
    const [explLoading, setExplLoading] = useState(false);
    const [explError, setExplError] = useState<string | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);

    async function onGenerate() {
        if (!prompt.trim()) return;
        setGenLoading(true);
        setGenError(null);
        setFormula(null);
        setGenExplanation(null);
        try {
            const res = await generateFormulaAction(prompt.trim());
            if ("error" in res) {
                setGenError(res.error);
            } else {
                setFormula(res.formula);
                setGenExplanation(res.explanation);
            }
        } catch {
            setGenError("Something went wrong. Try again.");
        } finally {
            setGenLoading(false);
        }
    }

    function onInsert() {
        if (formula) void grid.current?.commitActiveInput(formula);
    }

    async function onExplain() {
        const target = activeCellContent.trim();
        if (!target) {
            setExplError("Select a cell with a formula first.");
            setExplanation(null);
            return;
        }
        setExplLoading(true);
        setExplError(null);
        setExplanation(null);
        try {
            const res = await explainFormulaAction(target);
            if ("error" in res) {
                setExplError(res.error);
            } else {
                setExplanation(res.explanation);
            }
        } catch {
            setExplError("Something went wrong. Try again.");
        } finally {
            setExplLoading(false);
        }
    }

    return (
        <aside style={panel} aria-label="SabSheet AI">
            <header style={head}>
                <span style={headTitle}>
                    <span style={spark} aria-hidden>
                        ✦
                    </span>{" "}
                    AI
                </span>
                <button title="Close AI panel" onClick={onClose} style={closeBtn}>
                    ✕
                </button>
            </header>

            <nav style={tabStrip} role="tablist" aria-label="AI tools">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        role="tab"
                        aria-selected={s.id === section}
                        onClick={() => setSection(s.id)}
                        style={{ ...tab, ...(s.id === section ? tabActive : null) }}
                    >
                        {s.label}
                    </button>
                ))}
            </nav>

            <div style={body}>
                {section === "generate" && (
                    <section>
                        <label style={fieldLabel} htmlFor="ai-prompt">
                            Describe what you want to calculate
                        </label>
                        <textarea
                            id="ai-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Sum column B where column A equals &quot;Paid&quot;"
                            style={textarea}
                        />
                        <button
                            onClick={() => void onGenerate()}
                            disabled={genLoading || !prompt.trim()}
                            style={{
                                ...primaryBtn,
                                opacity: genLoading || !prompt.trim() ? 0.5 : 1,
                                cursor: genLoading || !prompt.trim() ? "default" : "pointer",
                            }}
                        >
                            {genLoading ? "Generating…" : "Generate formula"}
                        </button>

                        {genError && <p style={errorText}>{genError}</p>}

                        {formula && (
                            <div style={resultCard}>
                                <code style={formulaCode}>{formula}</code>
                                {genExplanation && <p style={explainText}>{genExplanation}</p>}
                                <button onClick={onInsert} style={insertBtn}>
                                    Insert into cell
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {section === "explain" && (
                    <section>
                        <label style={fieldLabel}>Active cell</label>
                        <code style={{ ...formulaCode, display: "block", marginBottom: 10 }}>
                            {activeCellContent.trim() || "(empty)"}
                        </code>
                        <button
                            onClick={() => void onExplain()}
                            disabled={explLoading}
                            style={{
                                ...primaryBtn,
                                opacity: explLoading ? 0.5 : 1,
                                cursor: explLoading ? "default" : "pointer",
                            }}
                        >
                            {explLoading ? "Explaining…" : "Explain this formula"}
                        </button>

                        {explError && <p style={errorText}>{explError}</p>}
                        {explanation && (
                            <div style={resultCard}>
                                <p style={explainText}>{explanation}</p>
                            </div>
                        )}
                    </section>
                )}

                {section === "ask" && (
                    <section style={placeholder}>
                        <p style={{ margin: 0, fontWeight: 600, color: "#202124" }}>Ask anything</p>
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5f6368" }}>
                            Conversational analysis over your sheet is coming soon.
                        </p>
                    </section>
                )}
            </div>
        </aside>
    );
}

const FONT = "13px -apple-system, system-ui, sans-serif";

const panel: React.CSSProperties = {
    width: 300,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    borderLeft: "1px solid #e1e3e6",
    font: FONT,
    color: "#202124",
};
const head: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: "1px solid #f1f3f4",
};
const headTitle: React.CSSProperties = { fontWeight: 600, fontSize: 13, color: "#1a73e8" };
const spark: React.CSSProperties = { color: "#1a73e8" };
const closeBtn: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: "#5f6368",
    cursor: "pointer",
    fontSize: 13,
    width: 24,
    height: 24,
    borderRadius: 4,
};
const tabStrip: React.CSSProperties = {
    display: "flex",
    gap: 2,
    padding: "6px 8px 0",
    borderBottom: "1px solid #f1f3f4",
};
const tab: React.CSSProperties = {
    border: "none",
    background: "transparent",
    padding: "6px 10px",
    borderRadius: "6px 6px 0 0",
    color: "#5f6368",
    cursor: "pointer",
    font: FONT,
    fontSize: 12,
};
const tabActive: React.CSSProperties = { color: "#1a73e8", fontWeight: 600, background: "#f8f9fa" };
const body: React.CSSProperties = { padding: 12, overflowY: "auto", flex: 1 };
const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    color: "#9aa0a6",
    marginBottom: 4,
};
const textarea: React.CSSProperties = {
    width: "100%",
    minHeight: 72,
    resize: "vertical",
    border: "1px solid #e1e3e6",
    borderRadius: 6,
    padding: 8,
    font: FONT,
    boxSizing: "border-box",
    marginBottom: 8,
};
const primaryBtn: React.CSSProperties = {
    width: "100%",
    height: 32,
    border: "none",
    borderRadius: 6,
    background: "#1a73e8",
    color: "#fff",
    fontWeight: 600,
    font: FONT,
};
const insertBtn: React.CSSProperties = {
    marginTop: 8,
    height: 28,
    padding: "0 12px",
    border: "1px solid #1a73e8",
    borderRadius: 6,
    background: "#fff",
    color: "#1a73e8",
    fontWeight: 600,
    font: FONT,
    cursor: "pointer",
};
const resultCard: React.CSSProperties = {
    marginTop: 12,
    padding: 10,
    border: "1px solid #e1e3e6",
    borderRadius: 8,
    background: "#f8f9fa",
};
const formulaCode: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    color: "#0b8043",
    wordBreak: "break-all",
};
const explainText: React.CSSProperties = {
    margin: "8px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#3c4043",
};
const errorText: React.CSSProperties = { margin: "10px 0 0", fontSize: 12, color: "#d93025" };
const placeholder: React.CSSProperties = {
    padding: 16,
    border: "1px dashed #e1e3e6",
    borderRadius: 8,
    background: "#fafafa",
    textAlign: "center",
};
