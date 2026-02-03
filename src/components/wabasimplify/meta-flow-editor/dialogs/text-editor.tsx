
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface TextEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

const fontSizes = [
  { label: 'Display', value: 'display' },
  { label: 'Large Title', value: 'large_title' },
  { label: 'Title', value: 'title' },
  { label: 'Headline', value: 'headline' },
  { label: 'Subheadline', value: 'subheadline' },
  { label: 'Body', value: 'body' },
  { label: 'Caption', value: 'caption' },
];

const fontWeights = [
  { label: 'Light', value: 'light' },
  { label: 'Regular', value: 'regular' },
  { label: 'Medium', value: 'medium' },
  { label: 'Bold', value: 'bold' },
];

const textColors = [
  { label: 'Default', value: 'default' },
  { label: 'Muted', value: 'muted' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Primary', value: 'primary' }, // Note: 'primary' might not be standard in all contexts, verifying 'success'/'warning'/'danger' are standard
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Danger', value: 'danger' },
  { label: 'Inverse', value: 'inverse' },
];

const textAlignments = [
  { label: 'Start (Left)', value: 'start' },
  { label: 'Center', value: 'center' },
  { label: 'End (Right)', value: 'end' },
];

export function TextEditor({ component, updateField }: TextEditorProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="text">Text Content</Label>
        <Textarea
          id="text"
          value={component.text || ''}
          onChange={e => updateField('text', e.target.value)}
          placeholder="Enter text..."
          className="min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Select value={component['font-size'] || 'body'} onValueChange={(val) => updateField('font-size', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {fontSizes.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Font Weight</Label>
          <Select value={component['font-weight'] || 'regular'} onValueChange={(val) => updateField('font-weight', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {fontWeights.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Result Color</Label>
          <Select value={component.color || 'default'} onValueChange={(val) => updateField('color', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {textColors.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select value={component['text-align'] || 'start'} onValueChange={(val) => updateField('text-align', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {textAlignments.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DynamicBooleanInput
        label="Italic"
        value={component['font-style'] === 'italic'}
        onChange={(val) => updateField('font-style', val ? 'italic' : 'normal')}
        placeholder="Cannot be dynamic"
      />

      <DynamicBooleanInput
        label="Visible"
        value={component.visible}
        onChange={(val) => updateField('visible', val)}
      />
    </div>
  );
}
