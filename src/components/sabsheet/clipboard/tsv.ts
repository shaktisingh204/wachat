/**
 * TSV serialization for clipboard copy. The engine's `paste_csv_string` consumes tab-delimited text
 * directly, so paste needs no parser here — only copy has to lay a sparse `CellView[]` back out into a
 * dense rectangle of tab/newline-separated text.
 */
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";
import type { RangeBox } from "../grid/selection.ts";

/** Lay sparse cells out as a dense TSV grid spanning `box` (blanks become empty fields). */
export function cellsToTsv(cells: CellView[], box: RangeBox): string {
  const byKey = new Map<string, string>();
  for (const c of cells) byKey.set(`${c.row},${c.col}`, c.text);

  const lines: string[] = [];
  for (let row = box.top; row <= box.bottom; row++) {
    const fields: string[] = [];
    for (let col = box.left; col <= box.right; col++) {
      const text = byKey.get(`${row},${col}`) ?? "";
      // Excel/Sheets quote fields containing tabs, newlines, or quotes.
      fields.push(needsQuoting(text) ? quote(text) : text);
    }
    lines.push(fields.join("\t"));
  }
  return lines.join("\n");
}

function needsQuoting(s: string): boolean {
  return s.includes("\t") || s.includes("\n") || s.includes('"');
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
