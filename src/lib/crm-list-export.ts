/**
 * Client-side CSV + XLSX export helpers for CRM list pages.
 *
 * `xlsx` is dynamically imported so card-only / table pages that never
 * trigger the XLSX path don't pay the bundle cost.
 *
 * Used by: accounts, contacts, products, services list pages.
 */

export type ExportRow = Record<string, unknown>;

function csvEscape(v: unknown): string {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function downloadCsv(
    filename: string,
    headers: string[],
    rows: ExportRow[],
): void {
    const csv = [
        headers.map(csvEscape).join(','),
        ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export async function downloadXlsx(
    filename: string,
    headers: string[],
    rows: ExportRow[],
    sheetName: string = 'Sheet1',
): Promise<void> {
    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
        const aoa: unknown[][] = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
        aoa.forEach((row) => worksheet.addRow(row));
        const out = await workbook.xlsx.writeBuffer();
        const blob = new Blob([out], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('[downloadXlsx] failed; falling back to CSV:', e);
        downloadCsv(filename.replace(/\.xlsx$/i, '.csv'), headers, rows);
    }
}

export function dateStamp(): string {
    return new Date().toISOString().slice(0, 10);
}
