import { Button } from '@/components/zoruui';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function GrnDetailNotFound() {
    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-zoru-line border-dashed p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                <FileQuestion className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-[15px] font-semibold text-zoru-ink">
                    GRN Not Found
                </h2>
                <p className="text-[13px] text-zoru-ink-muted">
                    The goods receipt note you are looking for does not exist or you do not have permission to view it.
                </p>
            </div>
            <Button variant="outline" asChild>
                <Link href="/dashboard/crm/inventory/grn">Back to GRNs</Link>
            </Button>
        </div>
    );
}
