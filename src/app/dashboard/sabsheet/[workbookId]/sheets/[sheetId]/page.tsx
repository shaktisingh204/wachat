import { notFound, redirect } from 'next/navigation';

import {
  getSabsheetWorkbook,
  listSabsheetCells,
  listSabsheetComments,
  listSabsheetNamedRanges,
  listSabsheetPivotTables,
  listSabsheetSheets,
} from '@/app/actions/sabsheet.actions';
import { WorkbookEditor } from '../../../_components/workbook-editor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workbookId: string; sheetId: string }>;
}

/**
 * Deep-link to a specific sheet in the editor. Loads the same editor
 * shell as `/dashboard/sabsheet/[workbookId]` but pre-selects the tab.
 */
export default async function SabsheetSheetDeepLinkPage({ params }: PageProps) {
  const { workbookId, sheetId } = await params;
  const workbook = await getSabsheetWorkbook(workbookId);
  if (!workbook) notFound();
  const sheets = await listSabsheetSheets(workbookId);
  const target = sheets.find((s) => s._id === sheetId);
  if (!target) {
    // Sheet is gone, drop back to the workbook root.
    redirect(`/dashboard/sabsheet/${workbookId}`);
  }
  const [cells, comments, namedRanges, pivots] = await Promise.all([
    listSabsheetCells(sheetId),
    listSabsheetComments(workbookId, { sheetId }),
    listSabsheetNamedRanges(workbookId),
    listSabsheetPivotTables(workbookId),
  ]);

  return (
    <div className="ui20 flex h-[calc(100vh-3.5rem)] flex-col">
      <WorkbookEditor
        workbook={workbook}
        sheets={sheets}
        activeSheetId={sheetId}
        initialCells={cells}
        initialComments={comments}
        initialNamedRanges={namedRanges}
        initialPivots={pivots}
      />
    </div>
  );
}
