
"use client";

import Split from "react-split";
import { MetaFlowNavigator } from "./meta-flow-navigator";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { MetaFlowProperties } from "./meta-flow-properties";
import { MetaFlowCanvas } from "./meta-flow-canvas";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface MetaFlowBuilderLayoutProps {
    // Flow Data State
    flowData: any;
    setFlowData: (data: any) => void;

    // Selection State
    selectedScreenId: string | null;
    setSelectedScreenId: (id: string | null) => void;

    selectedComponent: any | null;
    setSelectedComponent: (comp: any | null) => void;
}

export function MetaFlowBuilderLayout({
    flowData,
    setFlowData,
    selectedScreenId,
    setSelectedScreenId,
    selectedComponent,
    setSelectedComponent
}: MetaFlowBuilderLayoutProps) {

    // -- Handlers --

    const generateScreenId = () => {
        let result = 'SCREEN_';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const charactersLength = characters.length;
        for (let i = 0; i < 8; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    };

    const handleAddScreen = () => {
        const newScreenId = generateScreenId();
        const newScreen = {
            id: newScreenId,
            title: 'New Screen',
            layout: {
                type: 'SingleColumnLayout',
                children: [
                    { type: 'Form', name: `${newScreenId}_FORM`, children: [] }
                ]
            }
        };
        const newFlowData = { ...flowData };
        if (!newFlowData.screens) newFlowData.screens = [];
        newFlowData.screens = [...newFlowData.screens, newScreen];

        // Initialize routing model if needed
        if (!newFlowData.routing_model) newFlowData.routing_model = {};
        if (!newFlowData.routing_model[newScreenId]) {
            newFlowData.routing_model[newScreenId] = [];
        }

        setFlowData(newFlowData);
        setSelectedScreenId(newScreenId);
        setSelectedComponent(null);
    };

    const handleDeleteScreen = (screenId: string) => {
        if (!confirm("Are you sure you want to delete this screen?")) return;

        const newFlowData = { ...flowData };
        newFlowData.screens = newFlowData.screens.filter((s: any) => s.id !== screenId);

        // Clean up routing model
        if (newFlowData.routing_model) {
            delete newFlowData.routing_model[screenId];
            Object.keys(newFlowData.routing_model).forEach(key => {
                newFlowData.routing_model[key] = newFlowData.routing_model[key].filter((id: string) => id !== screenId);
            });
        }

        setFlowData(newFlowData);
        if (selectedScreenId === screenId) {
            setSelectedScreenId(newFlowData.screens[0]?.id || null);
            setSelectedComponent(null);
        }
    };

    const handleUpdateScreen = (updatedScreen: any) => {
        const newFlowData = { ...flowData };
        const index = newFlowData.screens.findIndex((s: any) => s.id === updatedScreen.id);
        if (index > -1) {
            newFlowData.screens[index] = updatedScreen;
            setFlowData(newFlowData);
        }
    };

    const handleAddComponent = (screenId: string, type: string) => {
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s: any) => s.id === screenId);
        if (!screen) return;

        let container = screen.layout.children.find((c: any) => c.type === 'Form');
        // If no Form container, create one (standard structure)
        if (!container) {
            container = { type: 'Form', name: `${screenId}_FORM`, children: [] };
            screen.layout.children.push(container);
        }

        let newComponent: any = { type, visible: true };
        const compId = uuidv4().split('-')[0];

        switch (type) {
            case 'Text':
                newComponent = {
                    type: 'Text',
                    text: 'New Text',
                    'font-size': 'body',
                    'text-align': 'start',
                    'font-weight': 'regular'
                };
                break;
            case 'TextInput':
                newComponent = {
                    type: 'TextInput',
                    name: `input_${compId}`,
                    label: 'Text Input',
                    required: false,
                    'input-type': 'text'
                };
                break;
            case 'Footer':
                newComponent = {
                    type: 'Footer',
                    label: 'Continue',
                    'on-click-action': { name: 'complete', payload: {} },
                    enabled: true
                };
                break;
            case 'OptIn':
                newComponent = {
                    type: 'OptIn',
                    name: `optin_${compId}`,
                    label: 'I agree to terms',
                    required: false,
                    enabled: true
                };
                break;
            case 'Image':
                newComponent = {
                    type: 'Image',
                    src: '',
                    'scale-type': 'cover',
                    height: 200,
                    enabled: true
                };
                break;
            case 'Dropdown':
                newComponent = {
                    type: 'Dropdown',
                    name: `dropdown_${compId}`,
                    label: 'Select Option',
                    required: false,
                    enabled: true,
                    'data-source': [
                        { id: '1', title: 'Option 1' },
                        { id: '2', title: 'Option 2' }
                    ]
                };
                break;
            case 'RadioButtonsGroup':
                newComponent = {
                    type: 'RadioButtonsGroup',
                    name: `radio_${compId}`,
                    label: 'Select One',
                    required: false,
                    enabled: true,
                    'data-source': [
                        { id: '1', title: 'Option 1' },
                        { id: '2', title: 'Option 2' }
                    ]
                };
                break;
            case 'CheckboxGroup':
                newComponent = {
                    type: 'CheckboxGroup',
                    name: `checkbox_${compId}`,
                    label: 'Select Multiple',
                    required: false,
                    enabled: true,
                    'data-source': [
                        { id: '1', title: 'Option 1' },
                        { id: '2', title: 'Option 2' }
                    ]
                };
                break;
            case 'DatePicker':
                newComponent = {
                    type: 'DatePicker',
                    name: `date_${compId}`,
                    label: 'Select Date',
                    required: false,
                    enabled: true
                };
                break;
            case 'Switch':
                newComponent = {
                    type: 'Switch',
                    name: `switch_${compId}`,
                    label: 'Switch Label',
                    enabled: true
                };
                break;
            case 'PhotoPicker':
                newComponent = {
                    type: 'PhotoPicker',
                    name: `photo_${compId}`,
                    label: 'Select Photo',
                    required: false,
                    enabled: true
                };
                break;
            case 'DocumentPicker':
                newComponent = {
                    type: 'DocumentPicker',
                    name: `doc_${compId}`,
                    label: 'Select Document',
                    required: false,
                    enabled: true
                };
                break;
            default:
                newComponent = { type, visible: true };
        }

        container.children.push(newComponent);
        setFlowData(newFlowData);
        setSelectedComponent(newComponent);
    };

    const handleDeleteComponent = (componentName: string) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s: any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container && container.children) {
                container.children = container.children.filter((c: any) => c.name !== componentName && c !== componentName);
            }
            setFlowData(newFlowData);
            setSelectedComponent(null);
        }
    };

    const handleUpdateComponent = (updatedComponent: any) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s: any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container && container.children) {
                let index = -1;
                if (updatedComponent.name) {
                    index = container.children.findIndex((c: any) => c.name === updatedComponent.name);
                }
                if (updatedComponent._id) {
                    index = container.children.findIndex((c: any) => c._id === updatedComponent._id);
                }

                if (index > -1) {
                    container.children[index] = updatedComponent;
                    setFlowData(newFlowData);
                    setSelectedComponent(updatedComponent);
                }
            }
        }
    };

    const currentScreen = flowData.screens?.find((s: any) => s.id === selectedScreenId) || null;

    return (
        <div className="h-full w-full relative">
            <style jsx global>{`
                .gutter {
                    background-color: hsl(var(--border));
                    background-repeat: no-repeat;
                    background-position: 50%;
                    cursor: col-resize;
                }
                .gutter:hover {
                    background-color: hsl(var(--primary) / 0.5);
                }
            `}</style>

            {(!flowData.screens || flowData.screens.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full bg-muted/20">
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-background rounded-full shadow-sm inline-block mb-4">
                            <Layers className="h-10 w-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">Start building your Flow</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                            Add your first screen to get started. Screens are the individual pages of your flow.
                        </p>
                        <Button size="lg" onClick={handleAddScreen} className="mt-4">
                            <Plus className="mr-2 h-5 w-5" />
                            Add Screen
                        </Button>
                    </div>
                </div>
            ) : (
                <Split
                    className="flex h-full"
                    sizes={[20, 50, 30]}
                    minSize={200}
                    expandToMin={false}
                    gutterSize={6}
                    gutterAlign="center"
                    snapOffset={30}
                    dragInterval={1}
                    direction="horizontal"
                    cursor="col-resize"
                >
                    {/* Left Pane (Navigator) */}
                    <div className="h-full overflow-hidden bg-background">
                        <MetaFlowNavigator
                            screens={flowData.screens || []}
                            selectedScreenId={selectedScreenId}
                            onSelectScreen={(id) => { setSelectedScreenId(id); setSelectedComponent(null); }}
                            onAddScreen={handleAddScreen}
                            onDeleteScreen={handleDeleteScreen}
                            selectedComponent={selectedComponent}
                            onSelectComponent={setSelectedComponent}
                            onDeleteComponent={handleDeleteComponent}
                            onAddComponent={handleAddComponent}
                        />
                    </div>

                    {/* Center Pane (Canvas) */}
                    <div className="h-full bg-background overflow-hidden border-l border-r relative">
                        <MetaFlowCanvas
                            flowData={flowData}
                            setFlowData={setFlowData}
                            selectedScreenId={selectedScreenId}
                        />
                    </div>

                    {/* Right Pane (Properties) */}
                    <div className="h-full bg-background overflow-hidden relative">
                        <MetaFlowProperties
                            selectedScreen={currentScreen}
                            onUpdateScreen={handleUpdateScreen}
                            onDeleteScreen={handleDeleteScreen}
                            selectedComponent={selectedComponent}
                            onUpdateComponent={handleUpdateComponent}
                            onDeleteComponent={handleDeleteComponent}
                            allScreens={flowData.screens || []}
                        />
                    </div>
                </Split>
            )}
        </div>
    );
}
