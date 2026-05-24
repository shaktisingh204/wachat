'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TdsForm } from '../_components/tds-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Upload, Users, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';

export function NewTdsClient() {
    const [activeTab, setActiveTab] = useState('single');
    const [csvData, setCsvData] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeUsers, setActiveUsers] = useState<number>(1);
    
    // Simulate real-time WebSocket connection for collaborative editing
    useEffect(() => {
        let mounted = true;
        const interval = setInterval(() => {
            if (mounted) {
                setActiveUsers(Math.floor(Math.random() * 3) + 1);
            }
        }, 15000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        // Simulate CSV parsing
        setTimeout(() => {
            const mockData = Array.from({ length: 5 }).map((_, i) => ({
                id: i,
                employeeName: `Employee ${i + 1}`,
                financialYear: '2025',
                quarter: 'Q1',
                grossAmount: 50000 + i * 10000,
                tdsAmount: 5000 + i * 1000,
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
        // Create CSV content
        const headers = ['Employee Name', 'Employee ID', 'Financial Year', 'Quarter', 'Gross Amount', 'TDS Amount'];
        const csvContent = headers.join(',') + '\nJohn Doe,EMP001,2025,Q1,100000,10000';
        
        // Create blob and download link
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
    
    // Date formatting to prevent hydration mismatches
    const [currentDate, setCurrentDate] = useState<string>('');
    useEffect(() => {
        setCurrentDate(new Date().toLocaleDateString());
    }, []);

    // Memoized derived data for bulk upload
    const totalTdsAmount = useMemo(() => {
        return csvData.reduce((acc, row) => acc + (row.tdsAmount || 0), 0);
    }, [csvData]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">New TDS Record</h2>
                    <p className="text-muted-foreground">
                        Record TDS for an employee or upload in bulk. {currentDate && `Today is ${currentDate}.`}
                    </p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span>{activeUsers} user(s) currently editing</span>
                    <Users className="h-4 w-4 ml-1" />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="single">Single Entry</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single" className="space-y-4">
                    <TdsForm />
                </TabsContent>
                
                <TabsContent value="bulk" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk Upload TDS Records</CardTitle>
                            <CardDescription>
                                Upload a CSV file to create multiple TDS records at once. Download the template first to ensure correct formatting.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                            
                            {isUploading && (
                                <div className="flex flex-col space-y-3">
                                    <Skeleton className="h-[20px] w-[100px] rounded-full" />
                                    <Skeleton className="h-[125px] w-full rounded-xl" />
                                </div>
                            )}

                            {csvData.length > 0 && !isUploading && (
                                <div className="space-y-4">
                                    <Alert>
                                        <FileSpreadsheet className="h-4 w-4" />
                                        <AlertTitle>Preview Data</AlertTitle>
                                        <AlertDescription>
                                            Found {csvData.length} records. Total TDS Amount: ₹{totalTdsAmount.toLocaleString('en-IN')}
                                        </AlertDescription>
                                    </Alert>
                                    
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Employee Name</TableHead>
                                                    <TableHead>FY</TableHead>
                                                    <TableHead>Quarter</TableHead>
                                                    <TableHead className="text-right">Gross Amount (₹)</TableHead>
                                                    <TableHead className="text-right">TDS Amount (₹)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {csvData.map((row) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                                                        <TableCell>{row.financialYear}</TableCell>
                                                        <TableCell>{row.quarter}</TableCell>
                                                        <TableCell className="text-right">{row.grossAmount.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right">{row.tdsAmount.toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    
                                    <div className="flex justify-end">
                                        <Button onClick={handleBulkSubmit} disabled={isPending}>
                                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            <Upload className="mr-2 h-4 w-4" />
                                            Submit Bulk Records
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
