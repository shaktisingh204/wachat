
'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function DelayEditor({ node, onUpdate }: EditorProps) {
  const inputs = node.data.inputs || {};

  // Backwards compatibility for existing nodes using 'delaySeconds' directly
  const currentValue = inputs.value !== undefined ? inputs.value : (node.data.delaySeconds || 1);
  const currentUnit = inputs.unit || 'seconds';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-2">
          <ZoruLabel htmlFor="delay-value">Delay Value</ZoruLabel>
          <ZoruInput
            id="delay-value"
            type="text"
            placeholder="e.g. 5 or {{variable}}"
            value={currentValue}
            onChange={(e) => {
              const val = e.target.value;
              // If it's a number, parse it, otherwise keep as string (variable)
              const isNum = !isNaN(parseFloat(val)) && isFinite(Number(val));

              onUpdate({
                delaySeconds: isNum ? parseFloat(val) : 0, // Legacy fallback (0 if var)
                inputs: { ...inputs, value: val, unit: currentUnit }
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <ZoruLabel htmlFor="delay-unit">Unit</ZoruLabel>
          <ZoruSelect
            value={currentUnit}
            onValueChange={(val) => {
              onUpdate({
                inputs: { ...inputs, value: currentValue, unit: val }
              });
            }}
          >
            <ZoruSelectTrigger id="delay-unit">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="seconds">Seconds</ZoruSelectItem>
              <ZoruSelectItem value="minutes">Minutes</ZoruSelectItem>
              <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
              <ZoruSelectItem value="days">Days</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <ZoruSwitch id="typing-indicator" checked={node.data.showTyping} onCheckedChange={(checked) => onUpdate({ showTyping: checked })} />
        <ZoruLabel htmlFor="typing-indicator">Show typing indicator</ZoruLabel>
      </div>
    </div>
  );
}
