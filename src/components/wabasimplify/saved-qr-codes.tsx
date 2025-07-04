
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Trash2, LoaderCircle } from 'lucide-react';
import type { WithId } from 'mongodb';
import { getQrCodes, deleteQrCode, type QrCode, type QrCodeWithShortUrl } from '@/app/actions/qr-code.actions';
import { QrCodeDialog } from './qr-code-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';


function DeleteQrCodeButton({ qrCode, onDeleted }: { qrCode: WithId<QrCode>, onDeleted: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteQrCode(qrCode._id.toString());
            if(result.success) {
                toast({ title: "Success", description: "QR Code deleted." });
                onDeleted();
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the QR code "{qrCode.name}". This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function SavedQrCodes({ initialQrCodes }: { initialQrCodes: WithId<QrCodeWithShortUrl>[] }) {
    const [qrCodes, setQrCodes] = useState(initialQrCodes);
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedQrData, setSelectedQrData] = useState<{dataString: string, config: any, logoDataUri?: string} | null>(null);

    const fetchData = () => {
        startLoadingTransition(async () => {
            const data = await getQrCodes();
            setQrCodes(data);
        });
    }
    
    useEffect(() => {
        setQrCodes(initialQrCodes);
    }, [initialQrCodes]);

    const generateDataString = (code: QrCode, codeWithUrl?: QrCodeWithShortUrl) => {
        if (code.dataType === 'url' && code.shortUrlId && codeWithUrl?.shortUrl) {
            const domain = window.location.origin;
            return `${domain}/s/${codeWithUrl.shortUrl.shortCode}`;
        }
        
        switch (code.dataType) {
            case 'url': return code.data.url;
            case 'text': return code.data.text;
            case 'email': return `mailto:${code.data.email}?subject=${encodeURIComponent(code.data.emailSubject)}&body=${encodeURIComponent(code.data.emailBody)}`;
            case 'phone': return `tel:${code.data.phone}`;
            case 'sms': return `smsto:${code.data.sms}:${encodeURIComponent(code.data.smsMessage)}`;
            case 'wifi': return `WIFI:T:${code.data.wifiEncryption};S:${code.data.wifiSsid};P:${code.data.wifiPassword};;`;
            default: return '';
        }
    };
    
    const handleViewQr = (code: WithId<QrCodeWithShortUrl>) => {
        const dataString = generateDataString(code, code);
        setSelectedQrData({ dataString, config: code.config, logoDataUri: code.logoDataUri });
    };

    return (
        <>
        <QrCodeDialog
            dataString={selectedQrData?.dataString || null}
            config={selectedQrData?.config}
            logoDataUri={selectedQrData?.logoDataUri}
            open={!!selectedQrData}
            onOpenChange={(open) => !open && setSelectedQrData(null)}
        />
        <Card className="card-gradient card-gradient-purple">
            <CardHeader>
                <CardTitle>Your Saved QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Data Preview</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                            : qrCodes.length > 0 ? qrCodes.map(code => (
                                <TableRow key={code._id.toString()}>
                                    <TableCell className="font-medium">{code.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="capitalize">{code.dataType}</Badge>
                                            {code.shortUrl && <Badge variant="secondary">Dynamic</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground truncate max-w-xs font-mono text-xs">
                                        {code.shortUrl ? (
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/dashboard/url-shortener/${code.shortUrl._id}`}>
                                                    View Analytics
                                                </Link>
                                            </Button>
                                        ) : (
                                            generateDataString(code)
                                        )}
                                    </TableCell>
                                    <TableCell>{new Date(code.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleViewQr(code)}><Eye className="h-4 w-4"/></Button>
                                        <DeleteQrCodeButton qrCode={code} onDeleted={fetchData} />
                                    </TableCell>
                                </TableRow>
                            ))
                            : <TableRow><TableCell colSpan={5} className="text-center h-24">No QR codes saved yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
