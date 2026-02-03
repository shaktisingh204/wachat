"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { WIDGET_REGISTRY } from '@/components/builder/registry';
import { DraggableSidebarItem } from './draggable-item';
import { StylePanel } from './style-panel';
import { ThemePanel } from './theme-panel';
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
            children: [] as any[]
        };

        const col1 = {
            id: uuidv4(),
            type: 'COLUMN',
            content: {},
            style: { padding: '10px' },
            children: []
        }

        newSection.children.push(col1);

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
                    <TabsTrigger value="global" className="flex-1">Global</TabsTrigger>
                </TabsList>
                <TabsContent value="add" className="p-4 space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-500">Layout</h3>
                        <DraggableSidebarItem type="SECTION" label="Section" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-500">Basic Widgets</h3>
                        {Object.keys(WIDGET_REGISTRY).map(type => (
                            <DraggableSidebarItem key={type} type={type} label={type} />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="edit" className="p-4 h-[calc(100vh-100px)] overflow-hidden flex flex-col">
                    {selectedElement ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex justify-between items-center pb-2 border-b">
                                <h3 className="font-medium text-sm">Content</h3>
                                <Button variant="destructive" size="sm" onClick={handleDelete} className="h-6 text-xs">Delete</Button>
                            </div>

                            {/* Content Tab */}
                            <div className="space-y-4 pb-4 border-b">
                                {selectedElement.type === 'WIDGET' && (
                                    <>
                                        {/* Text Content */}
                                        {['HEADING', 'TEXT', 'BUTTON'].includes(selectedElement.widgetType) && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Text</Label>
                                                <Input
                                                    value={selectedElement.content.text || ''}
                                                    onChange={(e) => handleUpdate('text', e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        )}

                                        {/* Image Source */}
                                        {selectedElement.widgetType === 'IMAGE' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Image URL</Label>
                                                <Input
                                                    value={selectedElement.content.src || ''}
                                                    onChange={(e) => handleUpdate('src', e.target.value)}
                                                    className="h-8 text-sm"
                                                    placeholder="https://..."
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                                {/* Common Settings for Columns/Sections could go here (e.g. Layout Flex) */}
                            </div>
                            {/* Styles Panel */}
                            <div className="flex-1 overflow-hidden">
                                <StylePanel />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-10">Select an element to edit</div>
                    )}
                </TabsContent>
                <TabsContent value="global" className="h-[calc(100vh-100px)] overflow-hidden">
                    <ThemePanel />
                </TabsContent>
            </Tabs>
        </div>
    );
};
