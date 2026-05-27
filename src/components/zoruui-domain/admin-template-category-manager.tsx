'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableRow,
} from '@/components/zoruui';
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
            <ZoruCardHeader>
                <ZoruCardTitle>Template Categories</ZoruCardTitle>
                <ZoruCardDescription>Manage the categories available for custom library templates.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
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
                        <ZoruTableBody>
                            {isLoading ? <ZoruTableRow><ZoruTableCell><LoaderCircle className="h-5 w-5 animate-spin"/></ZoruTableCell></ZoruTableRow>
                            : categories.length > 0 ? categories.map(cat => (
                                <ZoruTableRow key={cat._id.toString()}>
                                    <ZoruTableCell className="font-medium">{cat.name}</ZoruTableCell>
                                    <ZoruTableCell className="text-muted-foreground">{cat.description}</ZoruTableCell>
                                    <ZoruTableCell className="text-right w-16">
                                        <Button variant="ghost" size="icon" disabled>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                            : <ZoruTableRow><ZoruTableCell className="text-center text-muted-foreground">No custom categories created yet.</ZoruTableCell></ZoruTableRow>}
                        </ZoruTableBody>
                    </Table>
                </div>
            </ZoruCardContent>
        </Card>
    );
}
