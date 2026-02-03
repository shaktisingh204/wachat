"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui/accordion';

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
        return <div className="p-4 text-center text-gray-500">Select an element to edit styles</div>;
    }

    const handleUpdate = (styleProp: string, value: string) => {
        dispatch({
            type: 'UPDATE_ELEMENT',
            payload: {
                id: selectedElement.id,
                style: { [styleProp]: value }
            }
        });
    };

    // Helper to get current style value safely
    const getStyle = (prop: string) => selectedElement.style?.[prop] || '';

    return (
        <div className="h-full overflow-y-auto pr-2">
            <div className="mb-4 pb-4 border-b">
                <h3 className="font-semibold text-lg">{selectedElement.type} Styles</h3>
                <p className="text-xs text-gray-500">ID: {selectedElement.id.slice(0, 8)}</p>
            </div>

            <Accordion type="multiple" defaultValue={['typography', 'background', 'layout']}>

                {/* TYPOGRAPHY */}
                <AccordionItem value="typography">
                    <AccordionTrigger>Typography</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-8 h-8 p-0 border-0"
                                        value={getStyle('color') || '#000000'}
                                        onChange={(e) => handleUpdate('color', e.target.value)}
                                    />
                                    <Input
                                        className="h-8 text-xs"
                                        value={getStyle('color')}
                                        onChange={(e) => handleUpdate('color', e.target.value)}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Font Size</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('fontSize')}
                                    onChange={(e) => handleUpdate('fontSize', e.target.value)}
                                    placeholder="16px"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Font Weight</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('fontWeight')}
                                    onChange={(e) => handleUpdate('fontWeight', e.target.value)}
                                    placeholder="400"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Align</Label>
                                <div className="flex border rounded overflow-hidden h-8">
                                    {['left', 'center', 'right'].map(align => (
                                        <button
                                            key={align}
                                            onClick={() => handleUpdate('textAlign', align)}
                                            className={`flex-1 hover:bg-slate-100 text-xs ${getStyle('textAlign') === align ? 'bg-slate-200' : ''}`}
                                        >
                                            {align[0].toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* BACKGROUND */}
                <AccordionItem value="background">
                    <AccordionTrigger>Background</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div>
                            <Label className="text-xs">Background Color</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    className="w-8 h-8 p-0 border-0"
                                    value={getStyle('backgroundColor') || '#ffffff'}
                                    onChange={(e) => handleUpdate('backgroundColor', e.target.value)}
                                />
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('backgroundColor')}
                                    onChange={(e) => handleUpdate('backgroundColor', e.target.value)}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* LAYOUT */}
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout & Spacing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Padding</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('padding')}
                                    onChange={(e) => handleUpdate('padding', e.target.value)}
                                    placeholder="10px"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Margin</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('margin')}
                                    onChange={(e) => handleUpdate('margin', e.target.value)}
                                    placeholder="0px"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Height</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('height')}
                                    onChange={(e) => handleUpdate('height', e.target.value)}
                                    placeholder="auto"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Width</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('width')}
                                    onChange={(e) => handleUpdate('width', e.target.value)}
                                    placeholder="100%"
                                />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* BORDER */}
                <AccordionItem value="border">
                    <AccordionTrigger>Border</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Radius</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('borderRadius')}
                                    onChange={(e) => handleUpdate('borderRadius', e.target.value)}
                                    placeholder="4px"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Width</Label>
                                <Input
                                    className="h-8 text-xs"
                                    value={getStyle('borderWidth')}
                                    onChange={(e) => handleUpdate('borderWidth', e.target.value)}
                                    placeholder="1px"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-8 h-8 p-0 border-0"
                                        value={getStyle('borderColor') || '#000000'}
                                        onChange={(e) => handleUpdate('borderColor', e.target.value)}
                                    />
                                    <Input
                                        className="h-8 text-xs"
                                        value={getStyle('borderColor')}
                                        onChange={(e) => handleUpdate('borderColor', e.target.value)}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Style</Label>
                                <select
                                    className="h-8 text-xs w-full border rounded px-2"
                                    value={getStyle('borderStyle') || 'solid'}
                                    onChange={(e) => handleUpdate('borderStyle', e.target.value)}
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

            </Accordion>
        </div>
    );
};
