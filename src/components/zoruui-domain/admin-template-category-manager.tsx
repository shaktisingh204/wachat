'use client';

import { Card, CardBody, CardDescription, CardHeader, CardTitle, Button, Input, Table, TBody, Td, Tr } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useRef } from 'react';
import { getTemplateCategories,
  saveTemplateCategory,
  deleteTemplateCategory } from '@/app/actions/plan.actions';
import type { TemplateCategory } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useToast } from '@/hooks/use-toast';

import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

export function AdminTemplateCategoryManager() {
    const [categories, setCategories] = useState<WithId<TemplateCategory>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isSaving, startSavingTransition] = useTransition();
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

    const handleSubmit = (formData: FormData) => {
        startSavingTransition(async () => {
            const result = await saveTemplateCategory(null, formData);
            if (result.message) {
                toast({ title: 'Success!', description: result.message });
                fetchCategories();
                formRef.current?.reset();
            }
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Template Categories</CardTitle>
                <CardDescription>Manage the categories available for custom library templates.</CardDescription>
            </CardHeader>
            <CardBody>
                <form action={handleSubmit} ref={formRef} className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Input name="name" placeholder="New Category Name" required />
                    <Input name="description" placeholder="Description (optional)" />
                    <Button type="submit" disabled={isSaving} size="sm">
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Add
                    </Button>
                </form>
                <div className="border rounded-md">
                    <Table>
                        <TBody>
                            {isLoading ? <Tr><Td><LoaderCircle className="h-5 w-5 animate-spin"/></Td></Tr>
                            : categories.length > 0 ? categories.map(cat => (
                                <Tr key={cat._id.toString()}>
                                    <Td className="font-medium">{cat.name}</Td>
                                    <Td className="text-[var(--st-text-secondary)]">{cat.description}</Td>
                                    <Td className="text-right w-16">
                                        <Button variant="ghost" size="icon" disabled>
                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]"/>
                                        </Button>
                                    </Td>
                                </Tr>
                            ))
                            : <Tr><Td className="text-center text-[var(--st-text-secondary)]">No custom categories created yet.</Td></Tr>}
                        </TBody>
                    </Table>
                </div>
            </CardBody>
        </Card>
    );
}
