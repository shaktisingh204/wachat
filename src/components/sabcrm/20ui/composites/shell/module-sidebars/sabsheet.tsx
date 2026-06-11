"use client";

import { FileSpreadsheet, History, Printer, Table2 } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabSheet (spreadsheets) sidebar. Covers the v2 product at `/dashboard/sabsheet/v2`
 * (the IronCalc-backed grid the app entry opens). The in-workbook sheet tabs + ribbon
 * live inside the editor; this is module nav. When a workbook is open we surface
 * editor/print entries. The full-screen editor route overlays the rail by design.
 */
export const SABSHEET_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabsheet",
  heading: "SabSheet",
  caption: "Spreadsheets",
  build: (p) => {
    // The id segment after /v2/ (skipping the static "demo" route).
    const v2Seg = p.startsWith("/dashboard/sabsheet/v2/")
      ? p.slice("/dashboard/sabsheet/v2/".length).split("/")[0]
      : null;
    const workbookId = v2Seg && v2Seg !== "demo" ? v2Seg : null;

    return [
      {
        id: "sabsheet-main",
        label: "SabSheet",
        items: [
          leaf("workbooks", "Spreadsheets", "/dashboard/sabsheet/v2", FileSpreadsheet, p, { exact: true }),
          leaf("demo", "Demo sheet", "/dashboard/sabsheet/v2/demo", Table2, p),
        ],
      },
      ...(workbookId
        ? [
            {
              id: "sabsheet-workbook",
              label: "Current workbook",
              items: [
                leaf("editor", "Editor", `/dashboard/sabsheet/v2/${workbookId}`, Table2, p, { exact: true }),
                leaf("print", "Print / PDF", `/dashboard/sabsheet/v2/${workbookId}/print`, Printer, p),
              ],
            },
          ]
        : []),
      {
        id: "sabsheet-legacy",
        label: "Legacy",
        items: [
          leaf("legacy", "Old editor", "/dashboard/sabsheet", History, p, { exact: true }),
        ],
      },
    ];
  },
};
