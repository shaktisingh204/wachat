'use client';

import { Button } from '@/components/sabcrm/20ui';
import { Download } from 'lucide-react';
import type { CrmPayslipDoc } from '@/lib/rust-client/crm-payslips';
import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

export function PayslipDownloadButton({ payslip }: { payslip: CrmPayslipDoc }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const documentRef = useRef<HTMLDivElement>(null);

    const formatAmount = (val: number | undefined | null) => {
        if (val === undefined || val === null) return 'N/A';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val);
    };

    const handleDownload = async () => {
        if (!documentRef.current) return;
        setIsGenerating(true);
        try {
            const { jsPDF } = await import('jspdf');

            // Temporarily make the off-screen template visible for html2canvas
            const element = documentRef.current;
            element.style.display = 'block';

            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            
            // Hide it again
            element.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payslip_${payslip.employeeId}_${payslip.payPeriod || 'Unknown'}.pdf`);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Format pay period
    let periodFmt = payslip.payPeriod;
    if (periodFmt) {
        const m = /^(\d{4})-(\d{2})/.exec(periodFmt);
        if (m) {
            const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
            periodFmt = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
    }

    const issuedDate = payslip.issuedAt 
        ? new Date(payslip.issuedAt).toLocaleDateString() 
        : '—';

    const totalDeds = [payslip.pf, payslip.esi, payslip.tax, payslip.deductions].some(v => v === undefined || v === null) 
        ? null 
        : (payslip.pf || 0) + (payslip.esi || 0) + (payslip.tax || 0) + (payslip.deductions || 0);

    return (
        <>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGenerating}>
                <Download className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Download PDF'}
            </Button>

            {/* Off-screen Template for PDF Generation */}
            <div style={{ overflow: 'hidden', height: 0 }}>
                <div 
                    ref={documentRef} 
                    style={{ 
                        display: 'none', 
                        width: '800px', 
                        backgroundColor: '#ffffff',
                        padding: '40px',
                        color: '#000000',
                        fontFamily: 'Helvetica, Arial, sans-serif'
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase' }}>SabNode Inc.</h1>
                        <p style={{ fontSize: '14px', margin: '0', color: '#555' }}>123 Tech Park, Innovation Way, Silicon Valley</p>
                        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '20px 0 0 0', textTransform: 'uppercase' }}>Payslip</h2>
                        <p style={{ fontSize: '14px', margin: '5px 0 0 0', color: '#555' }}>For the period of {periodFmt || '—'}</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '14px' }}>
                        <div>
                            <p style={{ margin: '0 0 5px 0' }}><strong>Employee Name:</strong> {payslip.employeeName ?? '—'}</p>
                            <p style={{ margin: '0 0 5px 0' }}><strong>Employee ID:</strong> {payslip.employeeId}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0 0 5px 0' }}><strong>Issued Date:</strong> {issuedDate}</p>
                            <p style={{ margin: '0 0 5px 0' }}><strong>Status:</strong> {(payslip.status || 'draft').toUpperCase()}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '30px', marginBottom: '30px' }}>
                        {/* Earnings */}
                        <div style={{ flex: 1 }}>
                            <div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderBottom: '2px solid #ddd' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Earnings</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Basic</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.basic)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>HRA</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.hra)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Allowances</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.allowances)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', fontWeight: 'bold', borderTop: '2px solid #ddd' }}>Gross Earnings</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold', borderTop: '2px solid #ddd', textAlign: 'right' }}>{formatAmount(payslip.gross)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Deductions */}
                        <div style={{ flex: 1 }}>
                            <div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderBottom: '2px solid #ddd' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Deductions</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>PF</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.pf)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>ESI</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.esi)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Tax</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.tax)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Other Deductions</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(payslip.deductions)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', fontWeight: 'bold', borderTop: '2px solid #ddd' }}>Total Deductions</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold', borderTop: '2px solid #ddd', textAlign: 'right' }}>{formatAmount(totalDeds)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ backgroundColor: '#f9fafb', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Net Pay</h3>
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatAmount(payslip.net)}</span>
                    </div>

                    <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #ddd', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 5px 0' }}>This is a computer-generated document and complies with standard labor regulations.</p>
                        <p style={{ margin: 0 }}>No signature is required. Please report any discrepancies to the HR department immediately.</p>
                    </div>
                </div>
            </div>
        </>
    );
}
