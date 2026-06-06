'use client';

import {
  Button,
  Badge,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
  cn,
} from '@/components/sabcrm/20ui/compat';
import { useRef, useState } from 'react';
import { FileDown, Upload, CheckCircle, AlertCircle, LoaderCircle } from 'lucide-react';

interface BulkQrImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: () => void;
}

interface ParsedRow {
  name: string;
  dataType: string;
  data: string;
  isDynamic: boolean;
  tags: string[];
}

interface ParseError {
  row: number;
  message: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const TEMPLATE_ROWS = [
  ['name', 'dataType', 'data', 'isDynamic', 'tags'],
  ['My Website QR', 'url', '{"url":"https://example.com"}', 'true', 'marketing,web'],
  ['Office WiFi', 'wifi', '{"wifiSsid":"OfficeNet","wifiPassword":"pass123","wifiEncryption":"WPA","wifiHidden":false}', 'false', 'internal'],
  ['Contact Card', 'contact', '{"vcardFirstName":"Jane","vcardLastName":"Doe","vcardEmail":"jane@example.com"}', 'false', ''],
];

function downloadTemplateCsv() {
  const csvContent = TEMPLATE_ROWS.map(row =>
    row.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-qr-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  if (lines.length < 2) {
    errors.push({ row: 0, message: 'File must have a header row and at least one data row.' });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const [name, dataType, data, isDynamicRaw, tagsRaw] = cells.map(c => c.trim().replace(/^"|"$/g, ''));

    if (!name) {
      errors.push({ row: i + 1, message: 'Missing name.' });
      continue;
    }
    if (!dataType) {
      errors.push({ row: i + 1, message: 'Missing dataType.' });
      continue;
    }

    let parsedData = data;
    try {
      if (data) JSON.parse(data);
    } catch {
      errors.push({ row: i + 1, message: `Invalid JSON in data column.` });
      continue;
    }

    rows.push({
      name,
      dataType,
      data: parsedData,
      isDynamic: isDynamicRaw?.toLowerCase() === 'true',
      tags: tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [],
    });
  }

  return { rows, errors };
}

export function BulkQrImportDialog({ open, onOpenChange, onComplete }: BulkQrImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [fileError, setFileError] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setParseErrors([]);
    setFileError('');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setFileError('Only CSV files are accepted.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCsv(text);
      setParsedRows(rows);
      setParseErrors(errors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setStep('importing');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + 10;
      });
    }, 200);

    await new Promise(resolve => setTimeout(resolve, 2200));
    clearInterval(interval);
    setProgress(100);
    setStep('done');
  };

  const handleDone = () => {
    onComplete();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <ZoruDialogContent className="sm:max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-zoru-ink" />
            Bulk Import QR Codes
          </ZoruDialogTitle>
        </ZoruDialogHeader>

        {step === 'upload' && (
          <div className="space-y-5 py-2">
            <p className="text-sm text-zoru-ink-muted">
              Upload a CSV file with your QR code data. Each row becomes one QR code.
            </p>
            <div className="flex items-center justify-between p-3 bg-zoru-surface-2 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Download Template</p>
                <p className="text-xs text-zoru-ink-muted">CSV with example rows</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplateCsv}>
                <FileDown className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-csv-file">CSV File <span className="text-zoru-ink">*</span></Label>
              <input
                id="qr-csv-file"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium cursor-pointer"
              />
              <p className="text-xs text-zoru-ink-muted">Columns: name, dataType, data (JSON), isDynamic, tags (semicolon-separated)</p>
            </div>
            {fileError && (
              <p className="text-sm text-zoru-ink flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {fileError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{parsedRows.length} rows valid</Badge>
              {parseErrors.length > 0 && (
                <Badge variant="destructive">{parseErrors.length} errors</Badge>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-zoru-surface-2 border border-zoru-line rounded-lg p-3 space-y-1 max-h-28 overflow-y-auto">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-zoru-ink">Row {err.row}: {err.message}</p>
                ))}
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="border rounded-lg overflow-auto max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-zoru-surface-2 border-b">
                    <tr>
                      {['Name', 'Type', 'Dynamic', 'Tags'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-zoru-ink">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className={cn("border-b last:border-0", i % 2 === 1 && "bg-zoru-surface-2/50")}>
                        <td className="px-3 py-2 font-medium truncate max-w-[120px]">{row.name}</td>
                        <td className="px-3 py-2 text-zoru-ink-muted">{row.dataType}</td>
                        <td className="px-3 py-2">{row.isDynamic ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2 text-zoru-ink-muted truncate max-w-[100px]">{row.tags.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 5 && (
                  <p className="text-xs text-zoru-ink-muted text-center py-2 bg-zoru-surface-2">
                    +{parsedRows.length - 5} more rows
                  </p>
                )}
              </div>
            )}

            {parsedRows.length === 0 && (
              <p className="text-sm text-center text-zoru-ink-muted py-4">No valid rows found. Check your CSV format.</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={reset}>Back</Button>
              <Button onClick={handleImport} disabled={parsedRows.length === 0}>
                Import {parsedRows.length} QR Codes
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center gap-4">
              <LoaderCircle className="h-10 w-10 text-zoru-ink animate-spin" />
              <p className="font-medium">Importing QR codes...</p>
              <div className="w-full bg-zoru-surface-2 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-zoru-ink rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-zoru-ink-muted">{progress}% complete</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-zoru-surface-2 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-zoru-ink" />
              </div>
              <div>
                <p className="font-semibold text-lg">Import Started</p>
                <p className="text-sm text-zoru-ink-muted mt-1">
                  Your {parsedRows.length} QR codes are being processed. They will appear in your dashboard shortly.
                </p>
              </div>
            </div>
            <div className="flex justify-center pt-2">
              <Button onClick={handleDone}>Done</Button>
            </div>
          </div>
        )}
      </ZoruDialogContent>
    </Dialog>
  );
}
