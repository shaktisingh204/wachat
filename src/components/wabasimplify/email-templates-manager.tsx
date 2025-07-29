
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCrmEmailTemplates, deleteCrmEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CrmEmailTemplateDialog } from './crm-email-template-dialog';

export function CrmEmailTemplatesManager() {
    const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WithId<CrmEmailTemplate> | null>(null);

    const fetchData = () => {
        startLoading(async () => {
            const data = await getCrmEmailTemplates();
            setTemplates(data);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (templateId: string) => {
        const result = await deleteCrmEmailTemplate(templateId);
        if (result.success) {
            toast({ title: 'Success', description: 'Template deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleEdit = (template: WithId<CrmEmailTemplate>) => {
        setEditingTemplate(template);
        setIsDialogOpen(true);
    };

    const handleCreateNew = () => {
        setEditingTemplate(null);
        setIsDialogOpen(true);
    };

    return (
        <>
            <CrmEmailTemplateDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                template={editingTemplate}
                onSuccess={fetchData}
            />
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Email Templates</CardTitle>
                            <CardDescription>Create and manage reusable email templates for your CRM.</CardDescription>
                        </div>
                        <Button onClick={handleCreateNew}>
                            <Plus className="mr-2 h-4 w-4" /> New Template
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                         <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                         </div>
                    ) : templates.length > 0 ? (
                        <div className="border rounded-md">
                            {templates.map(template => (
                                <div key={template._id.toString()} className="flex items-center p-3 border-b last:border-b-0">
                                    <div className="flex-1">
                                        <p className="font-medium">{template.name}</p>
                                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}><Edit className="h-4 w-4"/></Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the "{template.name}" template.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(template._id.toString())}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                            <p>No email templates created yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}

// Removing incorrect export statement
// export { CrmEmailTemplatesManager as EmailTemplatesManager };
