import React from 'react';
import { Send, Check, X, Download, FileText } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';

interface TimesheetActionsProps {
  status: string;
  isSaving: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function TimesheetActions({
  status,
  isSaving,
  onExportCSV,
  onExportPDF,
  onSubmit,
  onApprove,
  onReject,
}: TimesheetActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onExportCSV}>
        <Download className="mr-2 h-4 w-4" />
        CSV
      </Button>
      <Button variant="outline" onClick={onExportPDF}>
        <FileText className="mr-2 h-4 w-4" />
        PDF
      </Button>
      {status === 'draft' && (
        <Button onClick={onSubmit} disabled={isSaving}>
          <Send className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Submit
        </Button>
      )}
      {status === 'submitted' && (
        <>
          <Button variant="outline" onClick={onApprove} disabled={isSaving}>
            <Check className="mr-2 h-4 w-4" strokeWidth={1.75} />
            Approve
          </Button>
          <Button variant="outline" onClick={onReject} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" strokeWidth={1.75} />
            Reject
          </Button>
        </>
      )}
    </div>
  );
}
