
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';

interface SwitchEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function SwitchEditor({ component, updateField }: SwitchEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="value">Value to Match</Label>
                <Input 
                    id="value" 
                    value={component.value || ''} 
                    onChange={(e) => updateField('value', e.target.value)} 
                    required 
                    placeholder="${form.animal}"
                    className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                    A dynamic variable whose value will be matched against the keys in the "cases" object.
                </p>
            </div>
            
            <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Case Management</AlertTitle>
                <AlertDescription>
                    The "cases" object, which defines the outcomes for each value, should be managed in the "Raw JSON" editor view for full control.
                </AlertDescription>
            </Alert>
        </div>
    );
}
