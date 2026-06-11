"use client";

import { FileSpreadsheet, History, Table2 } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabSheet (spreadsheets) sidebar. The in-workbook sheet tabs live in
 * `workbook-editor.tsx` (content tabs — not module nav). When a workbook
 * is open we surface scoped editor/history entries.
 */
export const SABSHEET_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabsheet",
  heading: "SabSheet",
  caption: "Spreadsheets",
  build: (p) => {
    const workbookId = p.startsWith("/dashboard/sabsheet/")
      ? p.slice("/dashboard/sabsheet/".length).split("/")[0] || null
      : null;

    return [
      {
        id: "sabsheet-main",
        label: "SabSheet",
        items: [
          leaf("workbooks", "Workbooks", "/dashboard/sabsheet", FileSpreadsheet, p, { exact: true }),
        ],
      },
      ...(workbookId
        ? [
            {
              id: "sabsheet-workbook",
              label: "Current workbook",
              items: [
                leaf("editor", "Editor", `/dashboard/sabsheet/${workbookId}`, Table2, p, { exact: true }),
                leaf("history", "Version history", `/dashboard/sabsheet/${workbookId}/history`, History, p),
              ],
            },
          ]
        : []),
    ];
  },
};
