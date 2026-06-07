"use client";

import React from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ColorPicker,
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { useEditor } from '@/components/builder/editor-provider';

const ALIGN_ITEMS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const;

const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'none', label: 'None' },
] as const;

export const StylePanel = () => {
  const { state, dispatch } = useEditor();

  // Helper to find the selected element to get current values
  const findElement = (elements: any[], id: string): any => {
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.children) {
        const found = findElement(el.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedElement = state.selectedElementId
    ? findElement(state.page.elements, state.selectedElementId)
    : null;

  if (!selectedElement) {
    return (
      <div className="p-4 text-center text-sm text-[var(--st-text-secondary)]">
        Select an element to edit styles
      </div>
    );
  }

  const handleUpdate = (styleProp: string, value: string) => {
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        id: selectedElement.id,
        style: { [styleProp]: value },
      },
    });
  };

  // Helper to get current style value safely
  const getStyle = (prop: string) => selectedElement.style?.[prop] || '';

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="mb-4 border-b border-[var(--st-border)] pb-4">
        <h3 className="text-lg font-semibold text-[var(--st-text)]">
          {selectedElement.type} Styles
        </h3>
        <p className="text-xs text-[var(--st-text-secondary)]">
          ID: {selectedElement.id.slice(0, 8)}
        </p>
      </div>

      <Accordion type="multiple" defaultValue={['typography', 'background', 'layout']}>
        {/* TYPOGRAPHY */}
        <AccordionItem value="typography">
          <AccordionTrigger>Typography</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <ColorPicker
                  value={getStyle('color') || '#000000'}
                  onChange={(color) => handleUpdate('color', color)}
                />
              </Field>
              <Field label="Font Size">
                <Input
                  inputSize="sm"
                  value={getStyle('fontSize')}
                  onChange={(e) => handleUpdate('fontSize', e.target.value)}
                  placeholder="16px"
                />
              </Field>
              <Field label="Font Weight">
                <Input
                  inputSize="sm"
                  value={getStyle('fontWeight')}
                  onChange={(e) => handleUpdate('fontWeight', e.target.value)}
                  placeholder="400"
                />
              </Field>
              <Field label="Align">
                <SegmentedControl
                  aria-label="Text align"
                  size="sm"
                  fullWidth
                  value={getStyle('textAlign') || 'left'}
                  onChange={(value) => handleUpdate('textAlign', value)}
                  items={ALIGN_ITEMS}
                />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* BACKGROUND */}
        <AccordionItem value="background">
          <AccordionTrigger>Background</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Field label="Background Color">
              <ColorPicker
                value={getStyle('backgroundColor') || '#ffffff'}
                onChange={(color) => handleUpdate('backgroundColor', color)}
              />
            </Field>
          </AccordionContent>
        </AccordionItem>

        {/* LAYOUT */}
        <AccordionItem value="layout">
          <AccordionTrigger>Layout &amp; Spacing</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Padding">
                <Input
                  inputSize="sm"
                  value={getStyle('padding')}
                  onChange={(e) => handleUpdate('padding', e.target.value)}
                  placeholder="10px"
                />
              </Field>
              <Field label="Margin">
                <Input
                  inputSize="sm"
                  value={getStyle('margin')}
                  onChange={(e) => handleUpdate('margin', e.target.value)}
                  placeholder="0px"
                />
              </Field>
              <Field label="Height">
                <Input
                  inputSize="sm"
                  value={getStyle('height')}
                  onChange={(e) => handleUpdate('height', e.target.value)}
                  placeholder="auto"
                />
              </Field>
              <Field label="Width">
                <Input
                  inputSize="sm"
                  value={getStyle('width')}
                  onChange={(e) => handleUpdate('width', e.target.value)}
                  placeholder="100%"
                />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* BORDER */}
        <AccordionItem value="border">
          <AccordionTrigger>Border</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Radius">
                <Input
                  inputSize="sm"
                  value={getStyle('borderRadius')}
                  onChange={(e) => handleUpdate('borderRadius', e.target.value)}
                  placeholder="4px"
                />
              </Field>
              <Field label="Width">
                <Input
                  inputSize="sm"
                  value={getStyle('borderWidth')}
                  onChange={(e) => handleUpdate('borderWidth', e.target.value)}
                  placeholder="1px"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Color">
                  <ColorPicker
                    value={getStyle('borderColor') || '#000000'}
                    onChange={(color) => handleUpdate('borderColor', color)}
                  />
                </Field>
              </div>
              <Field label="Style">
                <Select
                  value={getStyle('borderStyle') || 'solid'}
                  onValueChange={(value) => handleUpdate('borderStyle', value)}
                >
                  <SelectTrigger aria-label="Border style">
                    <SelectValue placeholder="Solid" />
                  </SelectTrigger>
                  <SelectContent>
                    {BORDER_STYLES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
