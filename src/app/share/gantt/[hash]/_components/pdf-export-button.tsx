'use client';

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/zoruui';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface PdfExportButtonProps {
  targetId: string;
  filename?: string;
}

export function PdfExportButton({ targetId, filename = 'project-timeline.pdf' }: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      toast.error('Gantt chart not found');
      return;
    }
    
    setIsExporting(true);
    toast.info('Preparing PDF...', { id: 'pdf-export' });
    
    try {
      const canvas = await html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedTarget = clonedDoc.getElementById(targetId);
          if (clonedTarget) {
            // Find any overflow-x-auto elements and make them visible so full content is captured
            const scrollableElements = clonedTarget.querySelectorAll('.overflow-x-auto');
            scrollableElements.forEach((el) => {
              (el as HTMLElement).style.overflowX = 'visible';
              (el as HTMLElement).style.width = 'max-content';
            });
            // Also adjust the card width to fit the content if needed
            clonedTarget.style.width = 'max-content';
            clonedTarget.style.minWidth = '100%';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const orientation = canvas.width > canvas.height ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
      
      toast.success('PDF exported successfully', { id: 'pdf-export' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF', { id: 'pdf-export' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToPDF}
      disabled={isExporting}
      className="flex items-center gap-2"
      data-html2canvas-ignore="true"
    >
      <Download className="h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
}
