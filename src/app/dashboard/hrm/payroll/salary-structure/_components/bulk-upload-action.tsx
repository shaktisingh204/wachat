'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    useZoruToast
} from '@/components/zoruui';

export function BulkUploadAction() {
    const [open, setOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useZoruToast();

    const handleUpload = () => {
        setIsUploading(true);
        setTimeout(() => {
            setIsUploading(false);
            setOpen(false);
            toast({
                title: 'Upload Successful',
                description: 'Bulk salary structures have been processed.',
                icon: <CheckCircle2 className="w-4 h-4 text-zoru-success" />
            });
        }, 1500);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Upload Salary Structures</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing bulk salary structures. Ensure headers match exactly: basic, hra, da, pfEmployer, pfEmployee, esi, professionalTax.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zoru-line rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
                    <FileText className="w-8 h-8 mb-4 opacity-50" />
                    <p className="text-[13px] text-center max-w-[250px]">
                        Drag and drop your CSV file here, or click to browse.
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
