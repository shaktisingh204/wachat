"use client";

import * as React from "react";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';

export interface SabsmsExportMenuProps {
  /** CSV exporter — return text to download. */
  toCsv?: () => Promise<string>;
  /** JSON / NDJSON exporter — return text to download. */
  toJson?: () => Promise<string>;
  /** Excel exporter — return a blob. */
  toXlsx?: () => Promise<Blob>;
  /** Filename root (without extension). */
  filename?: string;
}

function triggerDownload(filename: string, contents: BlobPart, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SabsmsExportMenu({
  toCsv,
  toJson,
  toXlsx,
  filename = "sabsms-export",
}: SabsmsExportMenuProps) {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function handle(kind: "csv" | "json" | "xlsx") {
    try {
      setBusy(kind);
      if (kind === "csv" && toCsv) {
        triggerDownload(`${filename}.csv`, await toCsv(), "text/csv");
      } else if (kind === "json" && toJson) {
        triggerDownload(`${filename}.jsonl`, await toJson(), "application/x-ndjson");
      } else if (kind === "xlsx" && toXlsx) {
        const blob = await toXlsx();
        triggerDownload(
          `${filename}.xlsx`,
          await blob.arrayBuffer(),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  if (!toCsv && !toJson && !toXlsx) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!busy}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {busy ? `Exporting ${busy}…` : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {toCsv && (
          <DropdownMenuItem onSelect={() => handle("csv")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
          </DropdownMenuItem>
        )}
        {toXlsx && (
          <DropdownMenuItem onSelect={() => handle("xlsx")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
          </DropdownMenuItem>
        )}
        {toJson && (
          <DropdownMenuItem onSelect={() => handle("json")}>
            <FileJson className="mr-2 h-4 w-4" /> JSONL
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pure-CSV helper for the common case: an array of homogeneous rows.
 */
export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T & string; header: string }[],
): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.key])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}
