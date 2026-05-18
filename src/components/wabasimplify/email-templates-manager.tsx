'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruSkeleton,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition } from 'react';
import { getCrmEmailTemplates,
  deleteCrmEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import type { WithId,
  CrmEmailTemplate } from '@/lib/definitions';
import { LoaderCircle, Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { CrmEmailTemplateDialog } from './crm-email-template-dialog';

export function EmailTemplatesManager() {
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
            <ZoruCard>
                <ZoruCardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <ZoruCardTitle>Email Templates</ZoruCardTitle>
                            <ZoruCardDescription>Create and manage reusable email templates for your CRM.</ZoruCardDescription>
                        </div>
                        <ZoruButton onClick={handleCreateNew}>
                            <Plus className="mr-2 h-4 w-4" /> New Template
                        </ZoruButton>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                     {isLoading ? (
                         <div className="space-y-2">
                            <ZoruSkeleton className="h-10 w-full" />
                            <ZoruSkeleton className="h-10 w-full" />
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
                                        <ZoruButton variant="ghost" size="icon" onClick={() => handleEdit(template)}><Edit className="h-4 w-4"/></ZoruButton>
                                         <ZoruAlertDialog>
                                            <ZoruAlertDialogTrigger asChild>
                                                <ZoruButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton>
                                            </ZoruAlertDialogTrigger>
                                            <ZoruAlertDialogContent>
                                                <ZoruAlertDialogHeader>
                                                    <ZoruAlertDialogTitle>Delete Template?</ZoruAlertDialogTitle>
                                                    <ZoruAlertDialogDescription>This will permanently delete the "{template.name}" template.</ZoruAlertDialogDescription>
                                                </ZoruAlertDialogHeader>
                                                <ZoruAlertDialogFooter>
                                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                    <ZoruAlertDialogAction onClick={() => handleDelete(template._id.toString())}>Delete</ZoruAlertDialogAction>
                                                </ZoruAlertDialogFooter>
                                            </ZoruAlertDialogContent>
                                        </ZoruAlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                            <p>No email templates created yet.</p>
                        </div>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </>
    );
}
