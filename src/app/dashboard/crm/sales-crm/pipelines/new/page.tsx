
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

type Stage = {
  id: string;
  name: string;
  chance: number;
};

const defaultStages: Stage[] = [
  { id: uuidv4(), name: 'Open', chance: 10 },
  { id: uuidv4(), name: 'Contacted', chance: 20 },
  { id: uuidv4(), name: 'Proposal Sent', chance: 50 },
  { id: uuidv4(), name: 'Deal Done', chance: 100 },
  { id: uuidv4(), name: 'Lost', chance: 0 },
  { id: uuidv4(), name: 'Not Serviceable', chance: 0 },
];

export default function NewPipelinePage() {
  const [pipelineName, setPipelineName] = useState('Sales Pipeline');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<Stage[]>(defaultStages);

  const handleStageChange = (id: string, field: 'name' | 'chance', value: string | number) => {
    setStages(prevStages =>
      prevStages.map(stage =>
        stage.id === id ? { ...stage, [field]: value } : stage
      )
    );
  };

  const handleAddStage = () => {
    setStages(prev => [...prev, { id: uuidv4(), name: 'New Stage', chance: 0 }]);
  };

  const handleRemoveStage = (id: string) => {
    setStages(prev => prev.filter(stage => stage.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div>
            <Button asChild variant="ghost" className="-ml-4">
                <Link href="/dashboard/crm/sales-crm/pipelines">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Back to Pipelines
                </Link>
            </Button>
            <h1 className="text-3xl font-bold font-headline mt-2">Create New Pipeline</h1>
        </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Pipeline Name</Label>
            <Input
              id="pipeline-name"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Pipeline Stages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                {stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-4 p-2 rounded-md bg-muted/50">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor={`stage-name-${index}`} className="text-xs">Stage Name</Label>
                            <Input
                                id={`stage-name-${index}`}
                                value={stage.name}
                                onChange={e => handleStageChange(stage.id, 'name', e.target.value)}
                            />
                        </div>
                         <div className="w-32 space-y-1">
                            <Label htmlFor={`stage-chance-${index}`} className="text-xs">Closure Chances (%)</Label>
                            <Input
                                id={`stage-chance-${index}`}
                                type="number"
                                value={stage.chance}
                                onChange={e => handleStageChange(stage.id, 'chance', Number(e.target.value))}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStage(stage.id)}
                            className="self-end mb-1"
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button variant="outline" onClick={handleAddStage}>
                <Plus className="mr-2 h-4 w-4" /> Add New Stage
            </Button>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
