'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition } from 'react';

import { Plus, Trash2, LoaderCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import type { CrmPipeline, CrmPipelineStage } from '@/lib/definitions';
import { saveCrmPipelines } from '@/app/actions/crm-pipelines.actions';

interface EditPipelinesDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialPipelines?: CrmPipeline[];
    isCreating?: boolean;
}

const defaultStages: CrmPipelineStage[] = [
    { id: uuidv4(), name: 'Open', chance: 10 },
    { id: uuidv4(), name: 'Contacted', chance: 20 },
    { id: uuidv4(), name: 'Proposal Sent', chance: 50 },
    { id: uuidv4(), name: 'Deal Done', chance: 100 },
    { id: uuidv4(), name: 'Lost', chance: 0 },
];

export function EditPipelinesDialog({ isOpen, onOpenChange, onSuccess, initialPipelines = [], isCreating = false }: EditPipelinesDialogProps) {
    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    const [isSaving, startSavingTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            if (isCreating) {
                const newPipeline = { id: uuidv4(), name: 'New Sales Pipeline', stages: defaultStages };
                const newPipelines = [...initialPipelines, newPipeline];
                setPipelines(newPipelines);
                setActivePipelineId(newPipeline.id);
            } else {
                setPipelines(initialPipelines.length > 0 ? initialPipelines : [{ id: uuidv4(), name: 'Sales Pipeline', stages: defaultStages }]);
                setActivePipelineId(initialPipelines[0]?.id || null);
            }
        }
    }, [isOpen, isCreating, initialPipelines]);

    const activePipeline = pipelines.find(p => p.id === activePipelineId);

    const handlePipelineNameChange = (id: string, newName: string) => {
        setPipelines(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const handleStageChange = (pipelineId: string, stageId: string, field: 'name' | 'chance', value: string | number) => {
        setPipelines(prev => prev.map(p => {
            if (p.id === pipelineId) {
                const newStages = p.stages.map(s => s.id === stageId ? { ...s, [field]: value } : s);
                return { ...p, stages: newStages };
            }
            return p;
        }));
    };

    const handleAddStage = (pipelineId: string) => {
        setPipelines(prev => prev.map(p => {
            if (p.id === pipelineId) {
                return { ...p, stages: [...p.stages, { id: uuidv4(), name: 'New Stage', chance: 0 }] };
            }
            return p;
        }));
    };

    const handleRemoveStage = (pipelineId: string, stageId: string) => {
        setPipelines(prev => prev.map(p => {
            if (p.id === pipelineId) {
                return { ...p, stages: p.stages.filter(s => s.id !== stageId) };
            }
            return p;
        }));
    }

    const handleSave = () => {
        startSavingTransition(async () => {
            const result = await saveCrmPipelines(pipelines);
            if (result.success) {
                toast({ title: 'Success', description: 'Pipelines saved successfully.' });
                onSuccess();
                onOpenChange(false);
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                <ZoruDialogHeader className="px-6 pt-6 pb-2">
                    <ZoruDialogTitle>{isCreating ? 'Create New Pipeline' : 'Edit Pipelines'}</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        {isCreating ? 'Define the stages for your new sales pipeline.' : 'Manage your sales pipelines and their stages.'}
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="grid grid-cols-4 gap-6">
                        {!isCreating && (
                            <div className="col-span-1 space-y-2">
                                {pipelines.map(p => (
                                    <ZoruButton key={p.id} variant={activePipelineId === p.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActivePipelineId(p.id)}>
                                        {p.name}
                                    </ZoruButton>
                                ))}
                            </div>
                        )}
                        <div className={isCreating ? "col-span-4" : "col-span-3"}>
                            {activePipeline ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <ZoruLabel>Pipeline Name</ZoruLabel>
                                        <ZoruInput value={activePipeline.name} onChange={e => handlePipelineNameChange(activePipeline.id, e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Stages</ZoruLabel>
                                        <div className="space-y-2 pr-2">
                                            {activePipeline.stages.map((stage) => (
                                                <div key={stage.id} className="flex items-center gap-2">
                                                    <ZoruInput value={stage.name} onChange={e => handleStageChange(activePipelineId!, stage.id, 'name', e.target.value)} />
                                                    <ZoruInput type="number" value={stage.chance} onChange={e => handleStageChange(activePipelineId!, stage.id, 'chance', Number(e.target.value))} className="w-24" />
                                                    <ZoruButton variant="ghost" size="icon" onClick={() => handleRemoveStage(activePipelineId!, stage.id)}><Trash2 className="h-4 w-4" /></ZoruButton>
                                                </div>
                                            ))}
                                        </div>
                                        <ZoruButton variant="outline" size="sm" onClick={() => handleAddStage(activePipelineId!)}>
                                            <Plus className="mr-2 h-4 w-4" /> Add Stage
                                        </ZoruButton>
                                    </div>
                                </div>
                            ) : <p>ZoruSelect a pipeline to edit.</p>}
                        </div>
                    </div>
                </div>
                <ZoruDialogFooter className="px-6 pb-6 pt-2">
                    <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                    <ZoruButton onClick={handleSave} disabled={isSaving}>
                        {isSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

