'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SabFileUrlInput } from '@/components/sabfiles/sab-file-picker';
import { useToast } from '@/components/sabcrm/20ui';
import { updatePfEsiDocumentUrl } from '@/app/actions/crm-pf-esi.actions';

interface ChallanUploaderProps {
    recordId: string;
    initialUrl: string | null;
}

export function ChallanUploader({ recordId, initialUrl }: ChallanUploaderProps) {
    const [url, setUrl] = React.useState(initialUrl ?? '');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleChange = async (newUrl: string) => {
        setUrl(newUrl);
        startTransition(async () => {
            const result = await updatePfEsiDocumentUrl(recordId, newUrl);
            if (result.error) {
                toast({
                    title: 'Update failed',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Success',
                    description: result.message || 'Challan updated.',
                });
                router.refresh();
            }
        });
    };

    return (
        <SabFileUrlInput
            value={url}
            onChange={handleChange}
            placeholder="No scanned challan uploaded"
            accept="document"
            disabled={isPending}
            pickerTitle="Upload Scanned Challan"
        />
    );
}
