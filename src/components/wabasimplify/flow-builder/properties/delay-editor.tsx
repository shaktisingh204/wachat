
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
          <Label htmlFor="delay-value">Delay Value</Label>
          <Input
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
          <Label htmlFor="delay-unit">Unit</Label>
          <Select
            value={currentUnit}
            onValueChange={(val) => {
              onUpdate({
                inputs: { ...inputs, value: currentValue, unit: val }
              });
            }}
          >
            <SelectTrigger id="delay-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Seconds</SelectItem>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="typing-indicator" checked={node.data.showTyping} onCheckedChange={(checked) => onUpdate({ showTyping: checked })} />
        <Label htmlFor="typing-indicator">Show typing indicator</Label>
      </div>
    </div>
  );
}
