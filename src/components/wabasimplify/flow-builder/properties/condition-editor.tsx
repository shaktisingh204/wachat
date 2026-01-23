
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ConditionEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label>Condition Type</Label>
            <RadioGroup value={node.data.conditionType || 'variable'} onValueChange={(val) => onUpdate({ ...node.data, conditionType: val })} className="flex gap-4 pt-1">
                <div className="flex items-center space-x-2"><RadioGroupItem value="variable" id="type-variable" /><Label htmlFor="type-variable" className="font-normal">Variable</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="user_response" id="type-user-response" /><Label htmlFor="type-user-response" className="font-normal">User Response</Label></div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p>
        </div>
        {(node.data.conditionType === 'variable' || !node.data.conditionType) && (
            <div className="space-y-2">
                <Label htmlFor="condition-variable">Variable to Check</Label>
                <Input id="condition-variable" placeholder="e.g., {{user_name}}" value={node.data.variable || ''} onChange={(e) => onUpdate({ ...node.data, variable: e.target.value })} />
            </div>
        )}
        <div className="space-y-2">
            <Label htmlFor="condition-operator">Operator</Label>
            <Select value={node.data.operator || 'equals'} onValueChange={(val) => onUpdate({ ...node.data, operator: val })}>
                <SelectTrigger id="condition-operator"><SelectValue/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Does not equal</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem>
                    <SelectItem value="is_not_one_of">Is not one of (comma-sep)</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="condition-value">Value to Compare Against</Label>
            <Input id="condition-value" placeholder="e.g., confirmed" value={node.data.value || ''} onChange={(e) => onUpdate({ ...node.data, value: e.target.value })} />
        </div>
    </div>
  );
}
