
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';

interface IfEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function IfEditor({ component, updateField }: IfEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="condition">Condition Expression</Label>
                <Input 
                    id="condition" 
                    value={component.condition || ''} 
                    onChange={(e) => updateField('condition', e.target.value)} 
                    required 
                    placeholder="${form.animal} == 'cat'"
                    className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                    A boolean expression. Use variables like <code>{`${'${form.some_value}'}`}</code>. Supported operators: ==, !=, &&, ||, !, &lt;, &gt;, &lt;=, &gt;=.
                </p>
            </div>
            
            <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Component Management</AlertTitle>
                <AlertDescription>
                    The components to show in the "then" and "else" branches should be managed in the "Raw JSON" editor view for full control over nested components.
                </AlertDescription>
            </Alert>
        </div>
    );
}
