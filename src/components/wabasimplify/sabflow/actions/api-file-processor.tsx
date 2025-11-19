
'use client';

import React, { useMemo } from 'react';
import { DynamicSelector } from '@/components/wabasimplify/sabflow/dynamic-selector';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { SabFlowNode } from '@/lib/definitions';
import { Input } from '@/components/ui/input';

interface ApiFileProcessorEditorProps {
  node: SabFlowNode;
  onUpdate: (data: any) => void;
  nodes: SabFlowNode[];
}

export function ApiFileProcessorEditor({ node, onUpdate, nodes }: ApiFileProcessorEditorProps) {
  const { copy } = useCopyToClipboard();

  const apiSteps = useMemo(() => {
    const currentStepIndex = nodes.findIndex(n => n.id === node.id);
    if (currentStepIndex === -1) return [];

    return nodes
      .slice(0, currentStepIndex)
      .filter(n => n.type === 'action' && n.data.appId === 'api') // Correctly filter for API steps
      .map(n => ({ value: n.data.name.replace(/ /g, '_'), label: n.data.name || n.id }));
  }, [nodes, node.id]);

  const handleInputChange = (name: string, value: any) => {
    onUpdate({ ...node.data, inputs: { ...node.data.inputs, [name]: value } });
  };
  
  const handleCopyToClipboard = (variableName: string) => {
    const stepName = node.data.name.replace(/ /g, '_');
    copy(`{{${stepName}.output.${variableName}}}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Source API Step</Label>
        <p className="text-xs text-muted-foreground">Select the previous "API Request" step that returns the file data.</p>
        <DynamicSelector
          value={node.data.inputs?.sourceApiStepName || ''}
          onChange={(val) => handleInputChange('sourceApiStepName', val)}
          options={apiSteps}
          placeholder="Select an API step..."
          emptyPlaceholder="No preceding API steps found."
        />
      </div>
      <div className="space-y-2">
        <Label>Filename</Label>
        <Input
          placeholder="e.g., invoice.pdf or {{trigger.filename}}"
          value={node.data.inputs?.filename || ''}
          onChange={(e) => handleInputChange('filename', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">The desired filename for the saved file, including its extension.</p>
      </div>
      <div className="pt-4 mt-4 border-t">
        <h4 className="font-semibold mb-2">Output</h4>
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
          <div>
            <p className="font-mono text-xs">{`{{${node.data.name.replace(/ /g, '_')}.output.fileUrl}}`}</p>
            <p className="text-xs text-muted-foreground">The public URL of the saved file.</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyToClipboard('fileUrl')}>
            <Copy className="h-4 w-4"/>
          </Button>
        </div>
      </div>
    </div>
  );
}
