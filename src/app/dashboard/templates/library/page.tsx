
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { premadeTemplates } from '@/lib/premade-templates';
import type { Template } from '@/app/dashboard/page';
import { BookCopy, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function TemplateLibraryPage() {
    const router = useRouter();

    const handleUseTemplate = (template: Omit<Template, 'metaId' | 'status' | 'qualityScore'>) => {
        // We pass the template data to the create page via localStorage
        localStorage.setItem('templateToAction', JSON.stringify(template));
        router.push('/dashboard/templates/create?action=clone');
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/templates">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to My Templates
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BookCopy className="h-8 w-8" />
                        Template Library
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Browse pre-made, high-quality templates to get started quickly.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {premadeTemplates.map((template, index) => (
                    <Card key={index} className="flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base">{template.name}</CardTitle>
                                <Badge variant="secondary" className="capitalize">
                                    {template.category.replace(/_/g, ' ').toLowerCase()}
                                </Badge>
                            </div>
                            <CardDescription>A pre-built template for {template.category.replace(/_/g, ' ').toLowerCase()} use cases.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="p-4 bg-muted/50 rounded-md text-sm border">
                                <p className="font-mono whitespace-pre-wrap">{template.body}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => handleUseTemplate(template)}>
                                Use This Template
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
