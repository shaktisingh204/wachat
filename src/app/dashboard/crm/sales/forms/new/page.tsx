
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, CheckCircle, Eye, LoaderCircle, Save } from 'lucide-react';
import { CrmFormPreview } from '@/components/wabasimplify/crm-form-preview';
import { WebsiteBlockEditor } from '@/components/wabasimplify/website-builder/website-block-editor';
import { useToast } from '@/hooks/use-toast';
import { saveCrmForm } from '@/app/actions/crm-forms.actions';
import { useRouter } from 'next/navigation';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function NewCrmFormPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
    const [formId, setFormId] = useState<string | null>(null);

    const [settings, setSettings] = useState({
        title: 'My New Form',
        description: 'Fill out the details below.',
        fields: [
            { id: 'field_name', type: 'text', label: 'Name', placeholder: 'Enter your name', required: true, columnWidth: '100%' },
            { id: 'field_email', type: 'email', label: 'Email', placeholder: 'Enter your email', required: true, columnWidth: '100%' },
        ],
        submitButtonText: 'Submit',
    });

    const handleUpdate = (id: string, newSettings: any) => {
        setSettings(newSettings);
    };

    const handleRemove = (id: string) => {
        console.log(`Remove action called for block ${id}, but not applicable here.`);
    };
    
    const handleSave = () => {
        startSaving(async () => {
            const result = await saveCrmForm({
                formId: formId || undefined,
                name: settings.title,
                settings: settings,
            });

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Form saved successfully!' });
                if (result.formId) {
                    setFormId(result.formId);
                }
            }
        });
    };

    const embedCode = `<script src="${process.env.NEXT_PUBLIC_APP_URL}/api/crm/forms/embed/${formId}.js" async defer></script>`;

    return (
         <div className="flex flex-col h-full">
            <Dialog open={isEmbedDialogOpen} onOpenChange={setIsEmbedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Embed Your Form</DialogTitle>
                        <DialogDescription>Copy and paste this code into your website's HTML where you want the form to appear.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <CodeBlock code={embedCode} />
                    </div>
                </DialogContent>
            </Dialog>

            <header className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b bg-background">
                <div>
                     <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                        <Link href="/dashboard/crm/sales/forms" className="p-1 rounded-md hover:bg-muted">
                           <ArrowLeft className="h-5 w-5" />
                        </Link>
                        Create Form
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsEmbedDialogOpen(true)} disabled={!formId}><Code className="mr-2 h-4 w-4" />Get Embed Code</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {formId ? 'Update' : 'Publish'} Form
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_420px] gap-0 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1 bg-muted/30 p-4 sm:p-6 md:p-8 overflow-y-auto flex justify-center items-start">
                   <CrmFormPreview settings={settings} />
                </div>
                <div className="hidden lg:block lg:col-span-1 xl:col-span-1 bg-background border-l overflow-y-auto">
                    <WebsiteBlockEditor
                        selectedBlock={{ id: 'form-editor', type: 'form', settings: settings, children: [] }}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                        availableProducts={[]}
                    />
                </div>
            </main>
        </div>
    );
}

