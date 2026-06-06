import { notFound } from 'next/navigation';

import {
  getSabsheetWorkbook,
  listSabsheetCells,
  listSabsheetComments,
  listSabsheetNamedRanges,
  listSabsheetPivotTables,
  listSabsheetSheets,
} from '@/app/actions/sabsheet.actions';
import { WorkbookEditor } from '../_components/workbook-editor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workbookId: string }>;
}

export default async function SabsheetWorkbookPage({ params }: PageProps) {
  const { workbookId } = await params;
  const workbook = await getSabsheetWorkbook(workbookId);
  if (!workbook) notFound();

  const sheets = await listSabsheetSheets(workbookId);
  const activeSheet = sheets.find((s) => s._id === workbook.defaultSheetId) ?? sheets[0];
  const [cells, comments, namedRanges, pivots] = await Promise.all([
    activeSheet ? listSabsheetCells(activeSheet._id) : Promise.resolve([]),
    listSabsheetComments(workbookId, { sheetId: activeSheet?._id }),
    listSabsheetNamedRanges(workbookId),
    listSabsheetPivotTables(workbookId),
  ]);

  return (
    <div className="ui20 flex h-[calc(100vh-3.5rem)] flex-col">
      <WorkbookEditor
        workbook={workbook}
        sheets={sheets}
        activeSheetId={activeSheet?._id ?? null}
        initialCells={cells}
        initialComments={comments}
        initialNamedRanges={namedRanges}
        initialPivots={pivots}
      />
    </div>
  );
}
