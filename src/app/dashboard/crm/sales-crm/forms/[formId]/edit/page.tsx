'use client';

import {
  ZoruSkeleton,
  ZoruButton,
  ZoruInput,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  cn,
} from '@/components/zoruui';
import {
  cn as _zoruCn,
  Suspense,
  useEffect,
  useState,
  useTransition,
  useMemo } from 'react';
import { getCrmFormById,
  saveCrmForm } from '@/app/actions/crm-forms.actions';
import { notFound,
  useParams } from 'next/navigation';
import { CrmFormBuilder } from '@/components/wabasimplify/website-builder/crm-form-builder';
import type { WithId,
  CrmForm } from '@/lib/definitions';
import { ArrowLeft, Code2, Eye, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { CodeBlock } from '@/components/wabasimplify/code-block';

void _zoruCn;

function EditFormSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <ZoruSkeleton className="h-16 w-full" />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_420px] gap-0 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1 p-4">
                    <ZoruSkeleton className="h-full w-full" />
                </div>
                <div className="hidden lg:block p-4">
                    <ZoruSkeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    );
}

function CodeEmbedDialog({ embedScript }: { embedScript: string }) {
    return (
        <ZoruDialog>
            <ZoruDialogTrigger asChild>
                <ZoruButton variant="outline"><Code2 className="mr-2 h-4 w-4"/> Embed Code</ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-2xl overflow-hidden">
                 <ZoruDialogHeader>
                    <ZoruDialogTitle>Embed Form on Your Website</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Copy and paste this code snippet where you want the form to appear on your website.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                 <div className="py-4">
                    <CodeBlock code={embedScript} language="html" />
                </div>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function EditFormPageContent() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const formId = params.formId as string;
    
    const [initialForm, setInitialForm] = useState<WithId<CrmForm> | null>(null);
    const [formName, setFormName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, startSaving] = useTransition();

    useEffect(() => {
        if (formId) {
            getCrmFormById(formId).then(data => {
                if (!data) {
                    toast({ title: 'Error', description: 'Form not found.', variant: 'destructive' });
                    router.push('/dashboard/crm/sales-crm/forms');
                } else {
                    setInitialForm(data);
                    setFormName(data.name);
                }
                setIsLoading(false);
            });
        }
    }, [formId, router, toast]);

    const handleSave = async (layout: any, settings: any) => {
        if (!initialForm) return;
        startSaving(async () => {
            const result = await saveCrmForm({
                formId: initialForm._id.toString(),
                name: formName,
                settings: { ...settings, fields: layout }
            });
            if (result.error) {
                toast({ title: 'Error Saving Form', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success!', description: 'Form saved successfully.' });
                // We don't need to refetch because the builder state is already current
            }
        });
    }

    if (isLoading) {
        return <EditFormSkeleton />;
    }

    if (!initialForm) {
        return <EditFormSkeleton />; // Or a "not found" component
    }

    const embedScript = `<div data-sabnode-form-id="${initialForm?._id.toString()}"></div>\n<script src="${process.env.NEXT_PUBLIC_APP_URL}/api/crm/forms/embed/${initialForm?._id.toString()}.js" async defer></script>`;

    return (
         <div className="h-full flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b bg-card">
                <div className="flex items-center gap-2">
                    <ZoruButton variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/crm/sales-crm/forms">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </ZoruButton>
                    <ZoruInput value={formName} onChange={e => setFormName(e.target.value)} className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-1 h-auto" />
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" asChild>
                        <a href={`/embed/crm-form/${initialForm._id.toString()}`} target="_blank" rel="noopener noreferrer"><Eye className="mr-2 h-4 w-4"/> Preview</a>
                    </ZoruButton>
                    <CodeEmbedDialog embedScript={embedScript} />
                    <ZoruButton onClick={() => (window as any).triggerFormSave()} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Form
                    </ZoruButton>
                </div>
            </header>
             <CrmFormBuilder {...({ initialForm, onSave: handleSave } as any)} />
        </div>
    );
}

export default function EditFormPage() {
  return (
    <Suspense fallback={<EditFormSkeleton />}>
        <EditFormPageContent />
    </Suspense>
  );
}
