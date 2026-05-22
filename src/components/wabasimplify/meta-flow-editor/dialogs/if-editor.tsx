'use client';

import { Input, Label, Alert, ZoruAlertDescription, ZoruAlertTitle } from '@/components/zoruui';
import { Lightbulb } from 'lucide-react';

interface IfEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function IfEditor({ component, updateField }: IfEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <ZoruLabel htmlFor="condition">Condition Expression</ZoruLabel>
                <ZoruInput 
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
            
            <ZoruAlert>
                <Lightbulb className="h-4 w-4" />
                <ZoruAlertTitle>Component Management</ZoruAlertTitle>
                <ZoruAlertDescription>
                    The components to show in the "then" and "else" branches should be managed in the "Raw JSON" editor view for full control over nested components.
                </ZoruAlertDescription>
            </ZoruAlert>
        </div>
    );
}
