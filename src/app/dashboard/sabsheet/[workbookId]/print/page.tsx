/**
 * SabSheet v2 — print / "Save as PDF" route.
 *
 * A dedicated, chrome-free render of a workbook's active sheet for the browser's native print → PDF
 * pipeline (no server Chromium). The server component only resolves the workbook title (mirroring the
 * editor page) and hands the heavy lifting — bootstrapping the calc engine and reading the used range
 * — to the client `<PrintView>`.
 */
import { notFound } from "next/navigation";
import { getSabsheetWorkbook } from "@/app/actions/sabsheet.actions";
import { PrintView } from "./_print-view";

export const dynamic = "force-dynamic";

export default async function SabSheetV2PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ workbookId: string }>;
  searchParams: Promise<{ sheet?: string }>;
}) {
  const { workbookId } = await params;
  const { sheet } = await searchParams;

  let title = "Untitled spreadsheet";
  try {
    const wb = await getSabsheetWorkbook(workbookId);
    if (!wb) notFound();
    title = wb.title || title;
  } catch {
    notFound();
  }

  const sheetIndex = sheet != null && /^\d+$/.test(sheet) ? Number(sheet) : undefined;

  return <PrintView workbookId={workbookId} title={title} sheet={sheetIndex} />;
}
