"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { WIDGET_REGISTRY } from '@/components/builder/registry';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Assuming these exist usually
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';

export const BuilderSidebar = () => {
    const { state, dispatch } = useEditor();
    const selectedElement = state.selectedElementId
        ? findElement(state.page.elements, state.selectedElementId)
        : null;

    const handleAddWidget = (type: string) => {
        const newWidget = {
            id: uuidv4(),
            type: 'WIDGET',
            widgetType: type,
            content: { text: `New ${type}` },
            style: {},
            children: []
        };
        dispatch({
            type: 'ADD_ELEMENT',
            payload: { parentId: 'root', element: newWidget as any }
        });
    };

    const handleAddSection = () => {
        const newSection = {
            id: uuidv4(),
            type: 'SECTION',
            content: {},
            style: { padding: '20px', minHeight: '100px', backgroundColor: '#f3f4f6' },
            children: []
        };

        const col1 = {
            id: uuidv4(),
            type: 'COLUMN',
            content: {},
            style: { padding: '10px' },
            children: []
        }

        newSection.children.push(col1 as any);

        dispatch({
            type: 'ADD_ELEMENT',
            payload: { parentId: 'root', element: newSection as any }
        })
    }

    // Recursive search helper (duplicated logic, should be centralized but handled here for UI)
    function findElement(elements: any[], id: string): any {
        for (const el of elements) {
            if (el.id === id) return el;
            if (el.children) {
                const found = findElement(el.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    const handleUpdate = (field: string, value: any, isStyle = false) => {
        if (!selectedElement) return;
        const payload: any = { id: selectedElement.id };
        if (isStyle) {
            payload.style = { [field]: value };
        } else {
            payload.content = { [field]: value };
        }
        dispatch({ type: 'UPDATE_ELEMENT', payload });
    };

    const handleDelete = () => {
        if (!selectedElement) return;
        dispatch({ type: 'DELETE_ELEMENT', payload: selectedElement.id });
    }

    return (
        <div className="w-[300px] border-r bg-white h-full flex flex-col">
            <div className="p-4 border-b font-semibold">Elementor Lite</div>
            <Tabs defaultValue="add" className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger value="add" className="flex-1">Add</TabsTrigger>
                    <TabsTrigger value="edit" className="flex-1">Edit</TabsTrigger>
                </TabsList>
                <TabsContent value="add" className="p-4 space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-500">Layout</h3>
                        <Button variant="outline" className="w-full justify-start" onClick={handleAddSection}>
                            + Isolate Section (1 Col)
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-500">Basic Widgets</h3>
                        {Object.keys(WIDGET_REGISTRY).map(type => (
                            <Button key={type} variant="secondary" className="w-full justify-start text-sm" onClick={() => handleAddWidget(type)}>
                                {type}
                            </Button>
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="edit" className="p-4">
                    {selectedElement ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-medium">{selectedElement.type} Settings</h3>
                                <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
                            </div>

                            {selectedElement.type === 'WIDGET' && (
                                <div className="space-y-2">
                                    <Label>Text / Content</Label>
                                    <Input
                                        value={selectedElement.content.text || ''}
                                        onChange={(e) => handleUpdate('text', e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="space-y-2 pt-4 border-t">
                                <h4 className="text-sm font-medium">Styles</h4>
                                <div>
                                    <Label>Background Color</Label>
                                    <Input
                                        type="color"
                                        value={selectedElement.style.backgroundColor || '#ffffff'}
                                        onChange={(e) => handleUpdate('backgroundColor', e.target.value, true)}
                                    />
                                </div>
                                <div>
                                    <Label>Color</Label>
                                    <Input
                                        type="color"
                                        value={selectedElement.style.color || '#000000'}
                                        onChange={(e) => handleUpdate('color', e.target.value, true)}
                                    />
                                </div>
                                <div>
                                    <Label>Padding</Label>
                                    <Input
                                        value={selectedElement.style.padding || ''}
                                        onChange={(e) => handleUpdate('padding', e.target.value, true)}
                                        placeholder="e.g. 10px"
                                    />
                                </div>
                                <div>
                                    <Label>Font Size</Label>
                                    <Input
                                        value={selectedElement.style.fontSize || ''}
                                        onChange={(e) => handleUpdate('fontSize', e.target.value, true)}
                                        placeholder="e.g. 16px"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-10">Select an element to edit</div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};
