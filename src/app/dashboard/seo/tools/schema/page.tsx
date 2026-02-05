'use client';

import SchemaBuilder from '@/components/seo/schema-builder';
import { Card, CardContent } from '@/components/ui/card';
import { Code2 } from 'lucide-react';

export default function SchemaToolPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Code2 className="h-8 w-8 text-primary" />
                    Schema Markup Generator
                </h1>
                <p className="text-muted-foreground mt-1">
                    Create structured data to help search engines understand your content.
                </p>
            </div>

            <SchemaBuilder />
        </div>
    );
}
