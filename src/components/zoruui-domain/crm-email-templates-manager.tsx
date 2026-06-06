'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Button,
  Card,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useTransition } from 'react';
import { getCrmEmailTemplates,
  deleteCrmEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import type { WithId,
  CrmEmailTemplate } from '@/lib/definitions';

import { LoaderCircle, Plus, Trash2, Edit } from 'lucide-react';
import { CrmEmailTemplateDialog } from './crm-email-template-dialog';

export function CrmEmailTemplatesManager() {
    const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useZoruToast();
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
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-zoru-ink font-semibold text-lg">Email Templates</h2>
                        <p className="text-zoru-ink-muted text-sm">Create and manage reusable email templates for your CRM.</p>
                    </div>
                    <Button onClick={handleCreateNew}>
                        <Plus className="h-4 w-4" />
                        New Template
                    </Button>
                </div>
                <div>
                     {isLoading ? (
                         <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                         </div>
                    ) : templates.length > 0 ? (
                        <div className="border border-zoru-line rounded-md">
                            {templates.map(template => (
                                <div key={template._id.toString()} className="flex items-center p-3 border-b border-zoru-line last:border-b-0">
                                    <div className="flex-1">
                                        <p className="font-medium text-zoru-ink">{template.name}</p>
                                        <p className="text-sm text-zoru-ink-muted">{template.subject}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}><Edit className="h-4 w-4"/></Button>
                                         <ZoruAlertDialog>
                                            <ZoruAlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-zoru-danger-ink"/></Button>
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
                        <div className="text-center text-zoru-ink-muted py-12 border-2 border-dashed border-zoru-line rounded-lg">
                            <p>No email templates created yet.</p>
                        </div>
                    )}
                </div>
            </Card>
        </>
    );
}

export { CrmEmailTemplatesManager as EmailTemplatesManager };
