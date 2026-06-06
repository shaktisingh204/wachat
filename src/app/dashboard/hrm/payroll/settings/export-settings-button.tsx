'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import { Download, FileJson, FileText, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/sabcrm/20ui/compat';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions.types';

export function ExportSettingsButton({ settings }: { settings: PayrollSettings }) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const downloadFile = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const data = JSON.stringify(settings, null, 2);
      downloadFile(data, `payroll-settings-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast({ title: 'Export Successful', description: 'Your settings have been exported as JSON.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not export settings.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = Object.keys(settings).join(',');
      const values = Object.values(settings).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      const csv = `${headers}\n${values}`;
      downloadFile(csv, `payroll-settings-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      toast({ title: 'Export Successful', description: 'Your settings have been exported as CSV.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not export settings.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      // Stub PDF generation logic. A real app might use jspdf or a server route.
      const text = `Payroll Settings Summary\n\n` + Object.entries(settings).map(([k, v]) => `${k}: ${v}`).join('\n');
      downloadFile(text, `payroll-settings-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
      toast({ title: 'Export Successful', description: 'Your settings have been exported as Text (PDF stub).' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not export settings.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isExporting} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileJson className="mr-2 h-4 w-4" />
          Export to JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export to CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="mr-2 h-4 w-4" />
          Export to PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
