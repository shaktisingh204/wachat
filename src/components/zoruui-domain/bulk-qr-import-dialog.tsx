'use client';

import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Alert,
  EmptyState,
  Spinner,
  Progress,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  cn,
} from '@/components/sabcrm/20ui';
import { useRef, useState } from 'react';
import { FileDown, Upload, CheckCircle, FileSpreadsheet } from 'lucide-react';

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[var(--st-text)]" aria-hidden="true" />
            Bulk Import QR Codes
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-5 py-2">
            <p className="text-sm text-[var(--st-text-secondary)]">
              Upload a CSV file with your QR code data. Each row becomes one QR code.
            </p>
            <div className="flex items-center justify-between p-3 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">Download Template</p>
                <p className="text-xs text-[var(--st-text-secondary)]">CSV with example rows</p>
              </div>
              <Button variant="outline" size="sm" iconLeft={FileDown} onClick={downloadTemplateCsv}>
                Template
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--st-text)]">
                CSV File <span className="text-[var(--st-danger)]">*</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <Button
                variant="outline"
                block
                iconLeft={FileSpreadsheet}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose CSV File
              </Button>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Columns: name, dataType, data (JSON), isDynamic, tags (semicolon-separated)
              </p>
            </div>
            {fileError && (
              <Alert tone="danger">{fileError}</Alert>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Badge tone="neutral">{parsedRows.length} rows valid</Badge>
              {parseErrors.length > 0 && (
                <Badge tone="danger">{parseErrors.length} errors</Badge>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-3 space-y-1 max-h-28 overflow-y-auto">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-[var(--st-danger)]">Row {err.row}: {err.message}</p>
                ))}
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-auto max-h-52">
                <Table density="compact" stickyHeader>
                  <THead>
                    <Tr>
                      {['Name', 'Type', 'Dynamic', 'Tags'].map(h => (
                        <Th key={h}>{h}</Th>
                      ))}
                    </Tr>
                  </THead>
                  <TBody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <Tr key={i}>
                        <Td truncate className="max-w-[120px] font-medium">{row.name}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{row.dataType}</Td>
                        <Td>{row.isDynamic ? 'Yes' : 'No'}</Td>
                        <Td truncate className="max-w-[100px] text-[var(--st-text-secondary)]">
                          {row.tags.join(', ') || '-'}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
                {parsedRows.length > 5 && (
                  <p className="text-xs text-[var(--st-text-secondary)] text-center py-2 bg-[var(--st-bg-muted)]">
                    +{parsedRows.length - 5} more rows
                  </p>
                )}
              </div>
            )}

            {parsedRows.length === 0 && (
              <EmptyState
                icon={FileSpreadsheet}
                title="No valid rows found"
                description="Check your CSV format and try again."
                size="sm"
              />
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Back</Button>
              <Button variant="primary" onClick={handleImport} disabled={parsedRows.length === 0}>
                Import {parsedRows.length} QR Codes
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" label="Importing QR codes" />
              <p className="font-medium text-[var(--st-text)]">Importing QR codes...</p>
              <Progress value={progress} label="Import progress" className="w-full" />
              <p className="text-sm text-[var(--st-text-secondary)]">{progress}% complete</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-[var(--st-status-ok)]" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-lg text-[var(--st-text)]">Import Started</p>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                  Your {parsedRows.length} QR codes are being processed. They will appear in your dashboard shortly.
                </p>
              </div>
            </div>
            <DialogFooter className="justify-center">
              <Button variant="primary" onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
