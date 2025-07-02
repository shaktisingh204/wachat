
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DynamicBooleanInput } from './dynamic-boolean-input';
import { ActionEditor } from '../shared/action-editor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileUp } from 'lucide-react';

interface ImageEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
  updateAction: (action: any) => void;
}

export function ImageEditor({ component, updateField, updateAction }: ImageEditorProps) {
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) { // 100KB
      toast({
        title: 'File too large',
        description: 'Image size should not exceed 100KB for Base64 embedding.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      updateField('src', base64String);
    };
    reader.readAsDataURL(file);
  };
    
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="src">Image Source (Base64)</Label>
        <Textarea 
            id="src" 
            value={component.src || ''} 
            onChange={e => updateField('src', e.target.value)} 
            placeholder="data:image/png;base64,iVBORw0KGgo..." 
            className="font-mono text-xs h-32"
        />
        <div className="relative flex items-center">
            <div className="flex-grow border-t border-muted"></div>
            <span className="flex-shrink mx-2 text-xs text-muted-foreground">OR</span>
            <div className="flex-grow border-t border-muted"></div>
        </div>
        <Button asChild variant="outline">
            <Label className="cursor-pointer">
                <FileUp className="mr-2 h-4 w-4" />
                Upload Image (max 100KB)
                <Input type="file" accept="image/png, image/jpeg" className="sr-only" onChange={handleFileUpload} />
            </Label>
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alt-text">Alt Text</Label>
        <Input id="alt-text" value={component['alt-text'] || ''} onChange={e => updateField('alt-text', e.target.value)} />
      </div>

      <ActionEditor
        label="On Click Action (optional)"
        action={component['on-click-action']}
        onActionChange={updateAction}
        actionType="on-click-action"
      />

      <DynamicBooleanInput
        label="Visible"
        value={component.visible}
        onChange={(val) => updateField('visible', val)}
      />
    </div>
  );
}
