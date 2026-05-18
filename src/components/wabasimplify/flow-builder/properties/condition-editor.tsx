
'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruRadioGroup, ZoruRadioGroupItem } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ConditionEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <ZoruLabel>Condition Type</ZoruLabel>
            <ZoruRadioGroup value={node.data.conditionType || 'variable'} onValueChange={(val) => onUpdate({ conditionType: val })} className="flex gap-4 pt-1">
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="variable" id="type-variable" /><ZoruLabel htmlFor="type-variable" className="font-normal">Variable</ZoruLabel></div>
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="user_response" id="type-user-response" /><ZoruLabel htmlFor="type-user-response" className="font-normal">User Response</ZoruLabel></div>
            </ZoruRadioGroup>
            <p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p>
        </div>
        {(node.data.conditionType === 'variable' || !node.data.conditionType) && (
            <div className="space-y-2">
                <ZoruLabel htmlFor="condition-variable">Variable to Check</ZoruLabel>
                <ZoruInput id="condition-variable" placeholder="e.g., {{user_name}}" value={node.data.variable || ''} onChange={(e) => onUpdate({ variable: e.target.value })} />
            </div>
        )}
        <div className="space-y-2">
            <ZoruLabel htmlFor="condition-operator">Operator</ZoruLabel>
            <ZoruSelect value={node.data.operator || 'equals'} onValueChange={(val) => onUpdate({ operator: val })}>
                <ZoruSelectTrigger id="condition-operator"><ZoruSelectValue/></ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="equals">Equals</ZoruSelectItem>
                    <ZoruSelectItem value="not_equals">Does not equal</ZoruSelectItem>
                    <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                    <ZoruSelectItem value="is_one_of">Is one of (comma-sep)</ZoruSelectItem>
                    <ZoruSelectItem value="is_not_one_of">Is not one of (comma-sep)</ZoruSelectItem>
                    <ZoruSelectItem value="greater_than">Greater than</ZoruSelectItem>
                    <ZoruSelectItem value="less_than">Less than</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="condition-value">Value to Compare Against</ZoruLabel>
            <ZoruInput id="condition-value" placeholder="e.g., confirmed" value={node.data.value || ''} onChange={(e) => onUpdate({ value: e.target.value })} />
        </div>
    </div>
  );
}
