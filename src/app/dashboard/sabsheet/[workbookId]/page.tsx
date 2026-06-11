/**
 * SabSheet v2 editor — a real, persistent workbook.
 *
 * Because `workbookId` is passed to the Workbench, the IronCalc engine bootstraps from the server
 * snapshot and every edit autosaves through `/v1/sabsheet/ops` — and works fully offline (queued in
 * IndexedDB, synced on reconnect). New workbooks created via the launcher start empty here.
 */
import { notFound } from "next/navigation";
import { getSabsheetWorkbook } from "@/app/actions/sabsheet.actions";
import { Workbench } from "@/components/sabsheet/workbench";

export const dynamic = "force-dynamic";

export default async function SabSheetV2EditorPage({
  params,
}: {
  params: Promise<{ workbookId: string }>;
}) {
  const { workbookId } = await params;
  let title = "Untitled spreadsheet";
  try {
    const wb = await getSabsheetWorkbook(workbookId);
    if (!wb) notFound();
    title = wb.title || title;
  } catch {
    notFound();
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Workbench name={title} workbookId={workbookId} />
    </div>
  );
}
