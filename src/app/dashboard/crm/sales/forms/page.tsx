
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmForms } from '@/app/actions/crm-forms.actions';
import type { CrmForm } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, FileText, Eye, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const FORMS_PER_PAGE = 20;

export default function CrmFormsPage() {
    const [forms, setForms] = useState<WithId<CrmForm>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { forms: data, total } = await getCrmForms(currentPage, FORMS_PER_PAGE, searchQuery);
            setForms(data);
            setTotalPages(Math.ceil(total / FORMS_PER_PAGE));
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    if (isLoading && forms.length === 0) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (forms.length === 0 && !isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Card className="text-center max-w-2xl">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                            <FileText className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Lead Capture Forms</CardTitle>
                        <CardDescription>
                            Create and embed forms on your website to capture leads directly into your CRM.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/dashboard/crm/sales/forms/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Create First Form
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileText className="h-8 w-8" />
                        Forms
                    </h1>
                    <p className="text-muted-foreground">Manage your lead capture forms.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/forms/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Form
                    </Link>
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>All Forms</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Form Name</TableHead>
                                    <TableHead>Submissions</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {forms.map((form) => (
                                    <TableRow key={form._id.toString()}>
                                        <TableCell className="font-medium">{form.name}</TableCell>
                                        <TableCell>{form.submissionCount || 0}</TableCell>
                                        <TableCell><Badge variant="default">Published</Badge></TableCell>
                                        <TableCell>{formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
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
