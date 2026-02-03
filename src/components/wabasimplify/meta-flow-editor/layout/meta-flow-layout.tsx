
"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MetaFlowNavigator } from "./meta-flow-navigator";
import { MetaFlowProperties } from "./meta-flow-properties";
import { MetaFlowCanvas } from "./meta-flow-canvas";
import { useState } from "react";

interface MetaFlowBuilderLayoutProps {
    // Flow Data State
    flowData: any;
    setFlowData: (data: any) => void;

    // Selection State
    selectedScreenId: string | null;
    setSelectedScreenId: (id: string | null) => void;

    selectedComponent: any | null; // This is a bit tricky since components are objects. We might need a reference or just use the object reference.
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

    const handleDeleteComponent = (componentName: string) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s: any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container && container.children) {
                container.children = container.children.filter((c: any) => c.name !== componentName);
                setFlowData(newFlowData);
                setSelectedComponent(null);
            }
        }
    };

    const handleUpdateComponent = (updatedComponent: any) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s: any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container && container.children) {
                const index = container.children.findIndex((c: any) => c.name === updatedComponent.name); // Prefer ID/Name matching
                if (index > -1) {
                    container.children[index] = updatedComponent;
                    setFlowData(newFlowData);
                    // Update selected component reference to avoid stale state
                    setSelectedComponent(updatedComponent);
                }
            }
        }
    };

    const currentScreen = flowData.screens?.find((s: any) => s.id === selectedScreenId) || null;

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <MetaFlowNavigator
                    screens={flowData.screens || []}
                    selectedScreenId={selectedScreenId}
                    onSelectScreen={(id) => { setSelectedScreenId(id); setSelectedComponent(null); }}
                    onAddScreen={handleAddScreen}
                    onDeleteScreen={handleDeleteScreen}
                    selectedComponent={selectedComponent}
                    onSelectComponent={setSelectedComponent}
                    onDeleteComponent={handleDeleteComponent}
                />
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={50}>
                <MetaFlowCanvas
                    flowData={flowData}
                    setFlowData={setFlowData}
                    selectedScreenId={selectedScreenId}
                />
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={30} minSize={20}>
                <MetaFlowProperties
                    selectedScreen={currentScreen}
                    onUpdateScreen={handleUpdateScreen}
                    onDeleteScreen={handleDeleteScreen}
                    selectedComponent={selectedComponent}
                    onUpdateComponent={handleUpdateComponent}
                    onDeleteComponent={handleDeleteComponent}
                    allScreens={flowData.screens || []}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
