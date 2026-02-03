'use client';

import { Suspense, useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { flowCategories } from '@/components/wabasimplify/meta-flow-templates';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MetaFlowBuilderLayout } from '@/components/wabasimplify/meta-flow-editor/layout/meta-flow-layout';

const createFlowInitialState = { message: null, error: null, payload: null, debugInfo: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    const buttonText = isEditing ? 'Update Flow' : 'Save & Publish Flow';
    return (
        <Button type="submit" disabled={pending} size="sm">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
    );
}

function PageSkeleton() {
    return (
        <div className="flex flex-col h-full space-y-4 p-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="flex-1 grid grid-cols-12 gap-4">
                <Skeleton className="col-span-2 h-full" />
                <Skeleton className="col-span-7 h-full" />
                <Skeleton className="col-span-3 h-full" />
            </div>
        </div>
    );
}

function CreateMetaFlowPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);

    const [projectId, setProjectId] = useState<string | null>(null);
    const [flowName, setFlowName] = useState('New Interactive Flow');
    const [category, setCategory] = useState('');
    const [publishOnSave, setPublishOnSave] = useState(true);
    const [flowData, setFlowData] = useState<any>({ version: '3.0', screens: [], routing_model: {}, data_api_version: '3.0' });
    const [flowId, setFlowId] = useState<string | null>(null);
    const [metaId, setMetaId] = useState<string | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    // Editor Selection State
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<any | null>(null);

    const isEditing = !!flowId;

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);

        const flowIdParam = searchParams.get('flowId');
        if (flowIdParam) {
            setFlowId(flowIdParam);
            startLoadingTransition(async () => {
                const fetchedFlow = await getMetaFlowById(flowIdParam);
                if (fetchedFlow) {
                    setFlowName(fetchedFlow.name);
                    setCategory(fetchedFlow.categories?.[0] || '');
                    setFlowData(fetchedFlow.flow_data || { version: '3.0', screens: [], routing_model: {}, data_api_version: '3.0' });
                    setMetaId(fetchedFlow.metaId);
                    if (fetchedFlow.flow_data?.screens?.[0]) {
                        setSelectedScreenId(fetchedFlow.flow_data.screens[0].id);
                    }
                } else {
                    toast({ title: 'Error', description: 'Could not load the requested flow.', variant: 'destructive' });
                    router.push('/dashboard/flows');
                }
            });
        }
    }, [searchParams, router, toast]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <Suspense fallback={<PageSkeleton />}>
            <form action={formAction} className="h-[calc(100vh-theme(spacing.20))] flex flex-col">
                {projectId && <input type="hidden" name="projectId" value={projectId} />}
                {flowId && <input type="hidden" name="flowId" value={flowId} />}
                {metaId && <input type="hidden" name="metaId" value={metaId} />}
                <input type="hidden" name="flow_data" value={JSON.stringify(flowData, null, 2)} />
                <input type="hidden" name="publish" value={publishOnSave ? 'on' : 'off'} />

                {/* Header */}
                <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back</Link>
                        </Button>
                        <div className="h-6 w-px bg-border mx-2" />
                        <div className="flex items-center gap-2">
                            <Input
                                id="flowName"
                                name="flowName"
                                value={flowName}
                                onChange={(e) => setFlowName(e.target.value)}
                                required
                                className="h-8 w-64 border-transparent hover:border-input focus:border-input font-semibold text-lg px-2 shadow-none bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center  gap-2">
                            <Select name="category" value={category} onValueChange={setCategory} required>
                                <SelectTrigger id="category" className="h-8 w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>{flowCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="publishOnSave" checked={publishOnSave} onCheckedChange={setPublishOnSave} />
                            <Label htmlFor="publishOnSave" className="text-xs font-normal text-muted-foreground">Publish</Label>
                        </div>
                        <SubmitButton isEditing={isEditing} />
                    </div>
                </header>

                {/* Main Editor Layout */}
                <div className="flex-1 overflow-hidden">
                    <MetaFlowBuilderLayout
                        flowData={flowData}
                        setFlowData={setFlowData}
                        selectedScreenId={selectedScreenId}
                        setSelectedScreenId={setSelectedScreenId}
                        selectedComponent={selectedComponent}
                        setSelectedComponent={setSelectedComponent}
                    />
                </div>
            </form>
        </Suspense>
    );
}

export default function CreateMetaFlowPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CreateMetaFlowPageContent />
        </Suspense>
    );
}
