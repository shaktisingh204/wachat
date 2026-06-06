import React, { useState, useMemo, useTransition, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui/compat';
import { Alert, AlertDescription, AlertTitle } from '@/components/sabcrm/20ui/compat';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { Download, Upload, FileSpreadsheet, Loader2, Search } from 'lucide-react';

interface CsvRow {
    id: number;
    employeeName: string;
    financialYear: string;
    quarter: string;
    grossAmount: number;
    tdsAmount: number;
}

export function BulkUpload() {
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        // Simulate CSV parsing
        setTimeout(() => {
            const mockData = Array.from({ length: 1000 }).map((_, i) => ({
                id: i,
                employeeName: `Employee ${i + 1}`,
                financialYear: '2025',
                quarter: i % 4 === 0 ? 'Q1' : i % 4 === 1 ? 'Q2' : i % 4 === 2 ? 'Q3' : 'Q4',
                grossAmount: 50000 + (i % 10) * 10000,
                tdsAmount: 5000 + (i % 10) * 1000,
            }));
            startTransition(() => {
                setCsvData(mockData);
                setIsUploading(false);
                toast({
                    title: 'File parsed successfully',
                    description: `Loaded ${mockData.length} records from CSV.`,
                });
            });
        }, 1000);
    };

    const handleBulkSubmit = () => {
        setIsUploading(true);
        // Simulate optimistic UI and API call
        setTimeout(() => {
            startTransition(() => {
                setCsvData([]);
                setIsUploading(false);
                toast({
                    title: 'Bulk upload successful',
                    description: 'TDS records created successfully.',
                });
            });
        }, 1500);
    };

    const handleDownloadTemplate = () => {
        const headers = ['Employee Name', 'Employee ID', 'Financial Year', 'Quarter', 'Gross Amount', 'TDS Amount'];
        const csvContent = headers.join(',') + '\nJohn Doe,EMP001,2025,Q1,100000,10000';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'tds_bulk_upload_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Advanced filtering
    const filteredData = useMemo(() => {
        if (!searchQuery) return csvData;
        const lowerQ = searchQuery.toLowerCase();
        return csvData.filter(row => 
            row.employeeName.toLowerCase().includes(lowerQ) ||
            row.quarter.toLowerCase().includes(lowerQ) ||
            row.financialYear.toLowerCase().includes(lowerQ)
        );
    }, [csvData, searchQuery]);

    const totalTdsAmount = useMemo(() => {
        return filteredData.reduce((acc, row) => acc + (row.tdsAmount || 0), 0);
    }, [filteredData]);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 10,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Upload TDS Records</CardTitle>
                <CardDescription>
                    Upload a CSV file to create multiple TDS records at once. Download the template first to ensure correct formatting.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={isUploading || isPending}
                                className="w-[250px]"
                            />
                        </div>
                    </div>
                    {csvData.length > 0 && !isUploading && (
                        <div className="relative w-full sm:w-[250px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                            <Input
                                type="text"
                                placeholder="Filter records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                    )}
                </div>
                
                {isUploading && (
                    <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[20px] w-[100px] rounded-full" />
                        <Skeleton className="h-[200px] w-full rounded-xl" />
                    </div>
                )}

                {csvData.length > 0 && !isUploading && (
                    <div className="space-y-4">
                        <Alert>
                            <FileSpreadsheet className="h-4 w-4" />
                            <AlertTitle>Preview Data</AlertTitle>
                            <AlertDescription>
                                Showing {filteredData.length} records. Total TDS Amount: ₹{totalTdsAmount.toLocaleString('en-IN')}
                            </AlertDescription>
                        </Alert>
                        
                        <div className="border rounded-md overflow-hidden bg-zoru-surface">
                            <div className="grid grid-cols-5 bg-zoru-surface-2/50 p-3 text-sm font-medium border-b">
                                <div>Employee Name</div>
                                <div>FY</div>
                                <div>Quarter</div>
                                <div className="text-right">Gross Amount (₹)</div>
                                <div className="text-right">TDS Amount (₹)</div>
                            </div>
                            
                            {filteredData.length === 0 ? (
                                <div className="p-4 text-center text-sm text-zoru-ink-muted">
                                    No records found matching your filter.
                                </div>
                            ) : (
                                <div ref={parentRef} className="h-[300px] overflow-auto">
                                    <div
                                        style={{
                                            height: `${rowVirtualizer.getTotalSize()}px`,
                                            width: '100%',
                                            position: 'relative',
                                        }}
                                    >
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = filteredData[virtualRow.index];
                                            return (
                                                <div
                                                    key={row.id}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: `${virtualRow.size}px`,
                                                        transform: `translateY(${virtualRow.start}px)`,
                                                    }}
                                                    className="grid grid-cols-5 p-3 text-sm border-b items-center hover:bg-zoru-surface-2/50 transition-colors"
                                                >
                                                    <div className="truncate font-medium pr-2">{row.employeeName}</div>
                                                    <div>{row.financialYear}</div>
                                                    <div>{row.quarter}</div>
                                                    <div className="text-right pr-2">{row.grossAmount.toLocaleString('en-IN')}</div>
                                                    <div className="text-right pr-2">{row.tdsAmount.toLocaleString('en-IN')}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setCsvData([])} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button onClick={handleBulkSubmit} disabled={isPending || filteredData.length === 0}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Submit Bulk Records
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
