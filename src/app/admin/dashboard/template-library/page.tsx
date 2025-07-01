

'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, BookCopy, Check, X } from 'lucide-react';
import { getLibraryTemplates } from '@/app/actions';
import type { LibraryTemplate } from '@/lib/definitions';
import { AdminDeleteLibraryTemplateButton } from '@/components/wabasimplify/admin-delete-library-template-button';
import { Separator } from '@/components/ui/separator';
import { AdminTemplateCategoryManager } from '@/components/wabasimplify/admin-template-category-manager';

export default function AdminTemplateLibraryPage() {
    const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchTemplates = () => {
        startLoading(async () => {
            const data = await getLibraryTemplates();
            setTemplates(data);
        });
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const { customTemplates, premadeTemplatesList } = useMemo(() => {
        const custom: LibraryTemplate[] = [];
        const premade: LibraryTemplate[] = [];
        templates.forEach(t => {
            if (t.isCustom) custom.push(t);
            else premade.push(t);
        });
        return { customTemplates: custom, premadeTemplatesList: premade };
    }, [templates]);
    

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BookCopy className="h-8 w-8" />
                        Manage Template Library
                    </h1>
                    <p className="text-muted-foreground mt-2">Add, edit, or remove templates from the global user library.</p>
                </div>
                 <Button asChild>
                    <Link href="/admin/dashboard/template-library/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Template
                    </Link>
                </Button>
            </div>

            <AdminTemplateCategoryManager />

            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>Custom Library Templates</CardTitle>
                    <CardDescription>Templates you have added to the library. These can be deleted.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Language</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                : customTemplates.length > 0 ? customTemplates.map(template => (
                                    <TableRow key={template._id?.toString()}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell><Badge variant="outline">{template.category}</Badge></TableCell>
                                        <TableCell>{template.language}</TableCell>
                                        <TableCell className="text-right">
                                            <AdminDeleteLibraryTemplateButton templateId={template._id!.toString()} templateName={template.name}/>
                                        </TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={4} className="h-24 text-center">No custom templates added yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pre-made Templates</CardTitle>
                    <CardDescription>Core templates included with the application. These cannot be deleted.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Language</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                : premadeTemplatesList.map((template, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell><Badge variant="secondary">{template.category}</Badge></TableCell>
                                        <TableCell>{template.language}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
