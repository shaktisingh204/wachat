'use client';

import { cn as _zoruCn, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
void _zoruCn;

import SchemaBuilder from '@/components/seo/schema-builder';

import { Code2 } from 'lucide-react';

export default function SchemaToolPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Code2 className="h-8 w-8 text-zoru-ink" />
                    Schema Markup Generator
                </h1>
                <p className="text-zoru-ink-muted mt-1">
                    Create structured data to help search engines understand your content.
                </p>
            </div>

            <SchemaBuilder />
        </div>
    );
}
