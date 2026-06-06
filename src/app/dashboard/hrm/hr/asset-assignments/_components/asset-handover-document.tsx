'use client';
import { fmtDate } from '@/lib/utils';
import React from "react";

import { useState, useRef } from 'react';
import { Button, Card } from '@/components/sabcrm/20ui';
import { Download, Eraser, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export function AssetHandoverDocument({ assignment }: { assignment: any }) {
    const [generating, setGenerating] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const documentRef = useRef<HTMLDivElement>(null);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSignatureData(canvas.toDataURL('image/png'));
    };

    const generatePDF = async () => {
        if (!documentRef.current) return;
        setGenerating(true);
        try {
            const canvas = await html2canvas(documentRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Asset_Handover_${assignment.asset_name || assignment.asset_id}.pdf`);
        } catch (e) {
            console.error('Failed to generate PDF', e);
        } finally {
            setGenerating(false);
        }
    };

    const fmtDate = (value: unknown) => {
        if (!value) return '—';
        const d = new Date(value as string);
        return Number.isNaN(d.getTime()) ? '—' : fmtDate(d);
    };

    return (
        <Card className="p-6 mt-6 overflow-hidden">
            <h3 className="text-lg font-semibold text-[var(--st-text)] mb-4">Asset Handover Document</h3>
            
            {/* The Document Preview */}
            <div className="border border-[var(--st-border)] rounded-lg p-8 mb-6 bg-white overflow-x-auto">
                <div ref={documentRef} className="min-w-[600px] text-black">
                    <div className="text-center mb-8 border-b pb-4">
                        <h2 className="text-2xl font-bold uppercase tracking-wider">Asset Handover Form</h2>
                        <p className="text-sm text-[var(--st-text)] mt-1">Generated on {fmtDate()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h4 className="font-semibold border-b pb-1 mb-3">Employee Details</h4>
                            <p className="text-sm"><span className="font-medium">Name:</span> {assignment.employee_name || '—'}</p>
                            <p className="text-sm"><span className="font-medium">ID:</span> {assignment.employee_id}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold border-b pb-1 mb-3">Asset Details</h4>
                            <p className="text-sm"><span className="font-medium">Name:</span> {assignment.asset_name || '—'}</p>
                            <p className="text-sm"><span className="font-medium">ID:</span> {assignment.asset_id}</p>
                            <p className="text-sm"><span className="font-medium">Condition:</span> {assignment.condition_at_assign || '—'}</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h4 className="font-semibold border-b pb-1 mb-3">Assignment Details</h4>
                        <p className="text-sm"><span className="font-medium">Assigned Date:</span> {fmtDate(assignment.assigned_at)}</p>
                        <p className="text-sm"><span className="font-medium">Notes:</span> {assignment.notes || 'No notes provided.'}</p>
                    </div>

                    <div className="mt-12 mb-8">
                        <h4 className="font-bold mb-4">Terms & Conditions</h4>
                        <ul className="list-disc pl-5 text-sm space-y-2">
                            <li>I acknowledge receipt of the asset described above in the stated condition.</li>
                            <li>I agree to maintain the asset in good condition and report any damages immediately.</li>
                            <li>I understand this asset remains company property and must be returned upon request or termination of employment.</li>
                        </ul>
                    </div>

                    <div className="mt-16 flex justify-between items-end">
                        <div className="w-64 text-center">
                            {signatureData ? (
                                <img src={signatureData} alt="Signature" className="h-16 mx-auto mb-2" />
                            ) : (
                                <div className="h-16 mb-2 border-b-2 border-dashed border-[var(--st-border)]"></div>
                            )}
                            <div className="border-t border-black pt-2">
                                <p className="font-semibold text-sm">Employee Signature</p>
                                <p className="text-xs text-[var(--st-text)]">{assignment.employee_name || assignment.employee_id}</p>
                            </div>
                        </div>
                        
                        <div className="w-64 text-center">
                            <div className="h-16 mb-2"></div>
                            <div className="border-t border-black pt-2">
                                <p className="font-semibold text-sm">Authorized By (HR)</p>
                                <p className="text-xs text-[var(--st-text)]">Date: {fmtDate(assignment.assigned_at)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signature Pad */}
            {!signatureData ? (
                <div className="mb-6">
                    <p className="text-sm font-medium mb-2">Please sign below to acknowledge receipt:</p>
                    <div className="border border-[var(--st-border)] rounded bg-[var(--st-bg-muted)] inline-block">
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={150}
                            className="cursor-crosshair block"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={clearSignature}>
                            <Eraser className="w-4 h-4 mr-2" /> Clear
                        </Button>
                        <Button size="sm" onClick={saveSignature}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Save Signature
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mb-6 flex gap-2 items-center text-sm text-[var(--st-text)] bg-[var(--st-bg-muted)] p-3 rounded-lg border border-[var(--st-border)]">
                    <CheckCircle2 className="w-5 h-5" />
                    Signature captured successfully.
                    <Button variant="link" size="sm" onClick={() => setSignatureData(null)} className="ml-auto text-[var(--st-text)]">
                        Sign again
                    </Button>
                </div>
            )}

            <Button onClick={generatePDF} disabled={generating} className="w-full sm:w-auto">
                {generating ? (
                    <><LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> Generating PDF...</>
                ) : (
                    <><Download className="w-4 h-4 mr-2" /> Download Document</>
                )}
            </Button>
        </Card>
    );
}
