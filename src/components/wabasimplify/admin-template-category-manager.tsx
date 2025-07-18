
'use client';

import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { getTemplateCategories, saveTemplateCategory, deleteTemplateCategory } from '@/app/actions/plan.actions';
import type { TemplateCategory } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

const saveInitialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="sm">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add
        </Button>
    )
}

function DeleteButton({ categoryId, onDeleted }: { categoryId: string, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteTemplateCategory(categoryId);
            if (result.message) {
                 toast({ title: "Success!", description: result.message });
                 onDeleted();
            }
            if(result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <Button type="button" variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
        </Button>
    );
}

export function AdminTemplateCategoryManager() {
    const [categories, setCategories] = useState<WithId<TemplateCategory>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [saveState, saveAction] = useActionState(saveTemplateCategory, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    
    const fetchCategories = () => {
        startLoadingTransition(async () => {
            const data = await getTemplateCategories();
            setCategories(data);
        });
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (saveState?.message) {
            toast({ title: 'Success!', description: saveState.message });
            fetchCategories();
            formRef.current?.reset();
        }
        if (saveState?.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Template Categories</CardTitle>
                <CardDescription>Manage the categories available for custom library templates.</CardDescription>
            </CardHeader>
            <CardContent>
                <form action={saveAction} ref={formRef} className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Input name="name" placeholder="New Category Name" required />
                    <Input name="description" placeholder="Description (optional)" />
                    <SaveButton />
                </form>
                <div className="border rounded-md">
                    <Table>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell><LoaderCircle className="h-5 w-5 animate-spin"/></TableCell></TableRow>
                            : categories.length > 0 ? categories.map(cat => (
                                <TableRow key={cat._id.toString()}>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{cat.description}</TableCell>
                                    <TableCell className="text-right w-16">
                                        <DeleteButton categoryId={cat._id.toString()} onDeleted={fetchCategories} />
                                    </TableCell>
                                </TableRow>
                            ))
                            : <TableRow><TableCell className="text-center text-muted-foreground">No custom categories created yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
