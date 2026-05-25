"use client";
import { fmtDate } from "@/lib/utils";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { Download } from 'lucide-react';

interface PdfButtonProps {
    contract: any;
}

export function PdfDownloadButton({ contract }: PdfButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDownload = async () => {
        try {
            setIsGenerating(true);
            const { jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas')).default;

            const element = containerRef.current;
            if (!element) return;

            // Make element temporarily visible for canvas rendering
            element.style.display = 'block';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 800,
            });

            element.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`${contract.title || 'Contract'}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!mounted) {
        return (
            <div className="mt-4 w-full">
                <Button variant="primary" className="w-full justify-center" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Download Contract PDF
                </Button>
            </div>
        );
    }

    return (
        <div className="mt-4 w-full">
            <Button
                variant="primary"
                className="w-full justify-center"
                onClick={handleDownload}
                disabled={isGenerating}
            >
                <Download className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating PDF...' : 'Download Contract PDF'}
            </Button>

            {/* Hidden container for PDF rendering */}
            <div style={{ overflow: 'hidden', height: 0, width: 0 }}>
                <div
                    ref={containerRef}
                    style={{
                        width: '800px',
                        padding: '40px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        fontFamily: 'sans-serif',
                        display: 'none',
                        position: 'absolute',
                        left: '-9999px',
                        top: '-9999px'
                    }}
                >
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
                        {contract.title || 'Contract'}
                    </h1>
                    <div style={{ marginBottom: '20px' }}>
                        <p><strong>Status:</strong> {contract.status}</p>
                        {contract.effectiveDate && (
                            <p><strong>Effective Date:</strong> {fmtDate(contract.effectiveDate)}</p>
                        )}
                        {contract.value != null && (
                            <p><strong>Value:</strong> {contract.currency} {contract.value}</p>
                        )}
                    </div>
                    
                    <div style={{ marginBottom: '30px', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '14px' }}>
                        {contract.body || contract.notes || 'No document content provided.'}
                    </div>

                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Signatures</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {(contract.signers || []).map((signer: any, idx: number) => (
                            <div key={idx} style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                                <p><strong>Name:</strong> {signer.name || '—'}</p>
                                <p><strong>Email:</strong> {signer.email || '—'}</p>
                                <p><strong>Role:</strong> {signer.role || '—'}</p>
                                <p>
                                    <strong>Signed At:</strong>{' '}
                                    {signer.signedAt ? fmtDate(signer.signedAt) : 'Pending'}
                                </p>
                                {signer.signatureMethod && (
                                    <p><strong>Method:</strong> {signer.signatureMethod}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
