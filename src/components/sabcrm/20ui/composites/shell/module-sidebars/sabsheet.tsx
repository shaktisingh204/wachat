"use client";

import { FileSpreadsheet, Printer, Table2 } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabSheet (spreadsheets) sidebar. The IronCalc-backed grid lives at `/dashboard/sabsheet`.
 * The in-workbook sheet tabs + ribbon live inside the editor; this is module nav. When a
 * workbook is open we surface editor/print entries. The full-screen editor overlays the rail.
 */
export const SABSHEET_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabsheet",
  heading: "SabSheet",
  caption: "Spreadsheets",
  build: (p) => {
    // The id segment after /sabsheet/ (skipping the static "demo" route).
    const seg = p.startsWith("/dashboard/sabsheet/")
      ? p.slice("/dashboard/sabsheet/".length).split("/")[0]
      : null;
    const workbookId = seg && seg !== "demo" ? seg : null;

    return [
      {
        id: "sabsheet-main",
        label: "SabSheet",
        items: [
          leaf("workbooks", "Spreadsheets", "/dashboard/sabsheet", FileSpreadsheet, p, { exact: true }),
          leaf("demo", "Demo sheet", "/dashboard/sabsheet/demo", Table2, p),
        ],
      },
      ...(workbookId
        ? [
            {
              id: "sabsheet-workbook",
              label: "Current workbook",
              items: [
                leaf("editor", "Editor", `/dashboard/sabsheet/${workbookId}`, Table2, p, { exact: true }),
                leaf("print", "Print / PDF", `/dashboard/sabsheet/${workbookId}/print`, Printer, p),
              ],
            },
          ]
        : []),
    ];
  },
};
