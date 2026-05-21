'use client';

/**
 * Search input for the Client Portal knowledge base. Submitting writes
 * the query to `?q=` (preserving any existing `?category=` filter)
 * which the server page reads on the next render.
 */

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { ZoruInput } from '@/components/zoruui/input';

export function KbSearch() {
    const router = useRouter();
    const search = useSearchParams();
    const [value, setValue] = React.useState(search?.get('q') ?? '');

    React.useEffect(() => {
        setValue(search?.get('q') ?? '');
    }, [search]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params = new URLSearchParams(search?.toString() ?? '');
        if (value.trim()) params.set('q', value.trim());
        else params.delete('q');
        const qs = params.toString();
        router.push(`/portal/client/knowledge-base${qs ? `?${qs}` : ''}`);
    };

    return (
        <form onSubmit={handleSubmit} className="relative max-w-md">
            <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted"
                aria-hidden
            />
            <ZoruInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search articles…"
                className="pl-9"
            />
        </form>
    );
}
