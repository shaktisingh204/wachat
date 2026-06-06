'use client';

import { Input } from '@/components/sabcrm/20ui/compat';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function IntegrationsSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (val) {
                params.set('q', val);
            } else {
                params.delete('q');
            }
            router.push(`?${params.toString()}`);
        });
    };

    return (
        <div className="relative mb-6 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <Input
                placeholder="Search integrations..."
                defaultValue={searchParams.get('q') ?? ''}
                onChange={handleSearch}
                className="pl-9"
            />
            {isPending && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zoru-ink-muted">Searching...</span>}
        </div>
    );
}
