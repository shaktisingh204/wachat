'use client';

import { Button } from '@/components/zoruui';
import { Download } from 'lucide-react';
import type { CrmPayslipDoc } from '@/lib/rust-client/crm-payslips';
import { useState } from 'react';

export function PayslipDownloadButton({ payslip }: { payslip: CrmPayslipDoc }) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const { jsPDF } = await import('jspdf');

            const doc = new jsPDF();
            
            // Basic Styling
            const pageWidth = doc.internal.pageSize.width;
            
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('PAYSLIP', pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('This is a computer generated document', pageWidth / 2, 26, { align: 'center' });

            doc.setLineWidth(0.5);
            doc.line(14, 32, pageWidth - 14, 32);

            // Employee Details
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Employee Details', 14, 42);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Employee Name: ${payslip.employeeName ?? '—'}`, 14, 50);
            doc.text(`Employee ID: ${payslip.employeeId}`, 14, 56);
            
            // Format pay period
            let periodFmt = payslip.payPeriod;
            if (periodFmt) {
                const m = /^(\d{4})-(\d{2})/.exec(periodFmt);
                if (m) {
                    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
                    periodFmt = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                }
            }
            
            doc.text(`Pay Period: ${periodFmt ?? '—'}`, pageWidth / 2, 50);
            
            const issuedDate = payslip.issuedAt 
                ? new Date(payslip.issuedAt).toLocaleDateString() 
                : '—';
            doc.text(`Issued Date: ${issuedDate}`, pageWidth / 2, 56);

            doc.line(14, 62, pageWidth - 14, 62);

            // Salary Breakdown Table Headers
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Earnings', 14, 72);
            doc.text('Deductions', pageWidth / 2, 72);
            
            doc.setFontSize(10);
            
            const formatAmount = (val: number | undefined | null) => {
                if (val === undefined || val === null) return 'N/A';
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0,
                }).format(val);
            };

            // Earnings
            let y = 80;
            doc.setFont('helvetica', 'normal');
            doc.text('Basic:', 14, y);
            doc.text(formatAmount(payslip.basic), 80, y, { align: 'right' });
            
            y += 8;
            doc.text('HRA:', 14, y);
            doc.text(formatAmount(payslip.hra), 80, y, { align: 'right' });
            
            y += 8;
            doc.text('Allowances:', 14, y);
            doc.text(formatAmount(payslip.allowances), 80, y, { align: 'right' });
            
            const earningsEndY = y;

            // Deductions
            y = 80;
            doc.text('PF:', pageWidth / 2, y);
            doc.text(formatAmount(payslip.pf), pageWidth - 14, y, { align: 'right' });
            
            y += 8;
            doc.text('ESI:', pageWidth / 2, y);
            doc.text(formatAmount(payslip.esi), pageWidth - 14, y, { align: 'right' });
            
            y += 8;
            doc.text('Tax:', pageWidth / 2, y);
            doc.text(formatAmount(payslip.tax), pageWidth - 14, y, { align: 'right' });
            
            y += 8;
            doc.text('Other Deductions:', pageWidth / 2, y);
            doc.text(formatAmount(payslip.deductions), pageWidth - 14, y, { align: 'right' });
            
            const deductionsEndY = y;
            
            y = Math.max(earningsEndY, deductionsEndY) + 10;
            
            doc.line(14, y, pageWidth - 14, y);
            y += 8;
            
            doc.setFont('helvetica', 'bold');
            doc.text('Gross Earnings:', 14, y);
            doc.text(formatAmount(payslip.gross), 80, y, { align: 'right' });
            
            const totalDeds = [payslip.pf, payslip.esi, payslip.tax, payslip.deductions].some(v => v === undefined || v === null) 
                ? null 
                : (payslip.pf || 0) + (payslip.esi || 0) + (payslip.tax || 0) + (payslip.deductions || 0);
            
            doc.text('Total Deductions:', pageWidth / 2, y);
            doc.text(formatAmount(totalDeds), pageWidth - 14, y, { align: 'right' });
            
            y += 6;
            doc.line(14, y, pageWidth - 14, y);
            
            // Net Pay
            y += 12;
            doc.setFontSize(14);
            doc.text('Net Pay:', 14, y);
            doc.text(formatAmount(payslip.net), 80, y, { align: 'right' });
            
            // Compliance footer
            y += 24;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100);
            doc.text('This payslip is generated automatically and complies with standard labor regulations.', 14, y);
            doc.text('Please report any discrepancies to the HR department immediately.', 14, y + 5);

            doc.save(`Payslip_${payslip.employeeId}_${payslip.payPeriod}.pdf`);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Download PDF'}
        </Button>
    );
}
