"use client";

import Split from "react-split";
import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { MetaFlowNavigator } from "./meta-flow-navigator";
import { MetaFlowProperties } from "./meta-flow-properties";
import { MetaFlowCanvas } from "./meta-flow-canvas";

interface MetaFlowBuilderLayoutProps {
    flowData: any;
    setFlowData: (data: any) => void;
    selectedScreenId: string | null;
    setSelectedScreenId: (id: string | null) => void;
    selectedComponent: any | null;
    setSelectedComponent: (comp: any | null) => void;
    onPublish?: () => void;
}

type Container = { type: string; name?: string; children?: any[] };

function generateScreenId() {
    let result = 'SCREEN_';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function shortId(prefix: string) {
    return `${prefix}_${uuidv4().split('-')[0]}`;
}

/**
 * Default JSON shapes for every v7.3 component.
 *
 * Keys exactly match Meta's Flow JSON schema — don't emit builder-only props.
 * Unknown keys are rejected by Meta, so keep this in sync with their
 * component reference.
 */
function buildDefaultComponent(type: string): any {
    switch (type) {
        // Text
        case 'TextHeading':    return { type, text: 'Heading' };
        case 'TextSubheading': return { type, text: 'Subheading' };
        case 'TextBody':       return { type, text: 'Body text' };
        case 'TextCaption':    return { type, text: 'Caption' };
        case 'RichText':       return { type, text: '**Rich** text' };

        // Media
        case 'Image':          return { type, src: '', 'scale-type': 'contain', 'aspect-ratio': 1 };
        case 'ImageCarousel':  return { type, 'aspect-ratio': '16:9', 'scale-type': 'cover', images: [] };
        case 'PhotoPicker':    return { type, name: shortId('photos'), label: 'Upload photos', 'photo-source': 'camera_gallery' };
        case 'DocumentPicker': return { type, name: shortId('docs'), label: 'Upload documents' };

        // Inputs
        case 'TextInput':      return { type, name: shortId('input'), label: 'Text input', 'input-type': 'text', required: false };
        case 'TextArea':       return { type, name: shortId('textarea'), label: 'Message', required: false };
        case 'Dropdown':       return { type, name: shortId('dropdown'), label: 'Select option', required: false, 'data-source': [{ id: '1', title: 'Option 1' }, { id: '2', title: 'Option 2' }] };
        case 'RadioButtonsGroup': return { type, name: shortId('radio'), label: 'Select one', required: false, 'data-source': [{ id: '1', title: 'Option 1' }, { id: '2', title: 'Option 2' }] };
        case 'CheckboxGroup':  return { type, name: shortId('checkboxes'), label: 'Select any', required: false, 'data-source': [{ id: '1', title: 'Option 1' }, { id: '2', title: 'Option 2' }] };
        case 'ChipsSelector':  return { type, name: shortId('chips'), label: 'Choose chips', 'data-source': [{ id: '1', title: 'Chip 1' }, { id: '2', title: 'Chip 2' }] };
        case 'DatePicker':     return { type, name: shortId('date'), label: 'Pick a date', required: false };
        case 'CalendarPicker': return { type, name: shortId('calendar'), label: 'Pick a date', mode: 'single' };
        case 'OptIn':          return { type, name: shortId('optin'), label: 'I agree', required: true };

        // Navigation / actions
        case 'Footer':         return { type, label: 'Continue', 'on-click-action': { name: 'complete', payload: {} } };
        case 'EmbeddedLink':   return { type, text: 'Learn more', 'on-click-action': { name: 'open_url', url: 'https://example.com' } };
        case 'NavigationList': return { type, name: shortId('nav'), 'list-items': [], 'on-click-action': { name: 'navigate', next: { type: 'screen', name: '' }, payload: {} } };

        // Logic
        case 'If':             return { type, condition: '${form.agree}', then: [], else: [] };
        case 'Switch':         return { type, value: '${form.choice}', cases: { default: [] } };

        default:               return { type };
    }
}

// Components that must live outside the Form (directly in the layout).
const LAYOUT_LEVEL_TYPES = new Set(['Footer', 'NavigationList', 'If', 'Switch', 'EmbeddedLink']);

export function MetaFlowBuilderLayout({
    flowData,
    setFlowData,
    selectedScreenId,
    setSelectedScreenId,
    selectedComponent,
    setSelectedComponent,
    onPublish,
}: MetaFlowBuilderLayoutProps) {

    const handleAddScreen = useCallback(() => {
        const newScreenId = generateScreenId();
        const newScreen = {
            id: newScreenId,
            title: 'New screen',
            layout: {
                type: 'SingleColumnLayout',
                children: [{ type: 'Form', name: `${newScreenId}_FORM`, children: [] }],
            },
        };
        const next = { ...flowData };
        next.screens = [...(next.screens || []), newScreen];
        next.routing_model = { ...(next.routing_model || {}) };
        if (!next.routing_model[newScreenId]) next.routing_model[newScreenId] = [];
        setFlowData(next);
        setSelectedScreenId(newScreenId);
        setSelectedComponent(null);
    }, [flowData, setFlowData, setSelectedScreenId, setSelectedComponent]);

    const handleDeleteScreen = useCallback((screenId: string) => {
        if (!confirm('Delete this screen? This cannot be undone.')) return;
        const next = { ...flowData };
        next.screens = (next.screens || []).filter((s: any) => s.id !== screenId);
        if (next.routing_model) {
            delete next.routing_model[screenId];
            Object.keys(next.routing_model).forEach(k => {
                next.routing_model[k] = next.routing_model[k].filter((id: string) => id !== screenId);
            });
        }
        setFlowData(next);
        if (selectedScreenId === screenId) {
            setSelectedScreenId(next.screens[0]?.id || null);
            setSelectedComponent(null);
        }
    }, [flowData, selectedScreenId, setFlowData, setSelectedScreenId, setSelectedComponent]);

    const handleUpdateScreen = useCallback((updated: any) => {
        const next = { ...flowData };
        const idx = next.screens.findIndex((s: any) => s.id === updated.id);
        if (idx > -1) {
            next.screens[idx] = updated;
            setFlowData(next);
        }
    }, [flowData, setFlowData]);

    const handleAddComponent = useCallback((screenId: string, type: string) => {
        const next = JSON.parse(JSON.stringify(flowData));
        const screen = next.screens.find((s: any) => s.id === screenId);
        if (!screen) return;

        const newComp = buildDefaultComponent(type);
        screen.layout.children = screen.layout.children || [];

        if (LAYOUT_LEVEL_TYPES.has(type)) {
            // Footer must always be the last layout child; others just go to the end too.
            screen.layout.children.push(newComp);
        } else {
            let form: Container | undefined = screen.layout.children.find((c: any) => c.type === 'Form');
            if (!form) {
                form = { type: 'Form', name: `${screenId}_FORM`, children: [] };
                // Insert before Footer if present.
                const footerIdx = screen.layout.children.findIndex((c: any) => c.type === 'Footer');
                if (footerIdx === -1) screen.layout.children.push(form);
                else screen.layout.children.splice(footerIdx, 0, form);
            }
            form.children = form.children || [];
            form.children.push(newComp);
        }

        setFlowData(next);
        setSelectedComponent(newComp);
    }, [flowData, setFlowData, setSelectedComponent]);

    const handleDeleteComponent = useCallback((identifier: any) => {
        if (!selectedScreenId) return;
        const next = JSON.parse(JSON.stringify(flowData));
        const screen = next.screens.find((s: any) => s.id === selectedScreenId);
        if (!screen) return;

        const removeFromChildren = (children: any[] | undefined): any[] | undefined => {
            if (!Array.isArray(children)) return children;
            return children.filter((c: any) => {
                if (typeof identifier === 'string') return c.name !== identifier;
                return c !== identifier;
            }).map((c: any) => {
                if (Array.isArray(c.children)) c.children = removeFromChildren(c.children);
                return c;
            });
        };

        screen.layout.children = removeFromChildren(screen.layout.children);
        setFlowData(next);
        setSelectedComponent(null);
    }, [flowData, selectedScreenId, setFlowData, setSelectedComponent]);

    const handleUpdateComponent = useCallback((updated: any) => {
        if (!selectedScreenId) return;
        const next = JSON.parse(JSON.stringify(flowData));
        const screen = next.screens.find((s: any) => s.id === selectedScreenId);
        if (!screen) return;

        const replaceIn = (arr: any[] | undefined): boolean => {
            if (!Array.isArray(arr)) return false;
            for (let i = 0; i < arr.length; i++) {
                const c = arr[i];
                if ((updated.name && c.name === updated.name) || (updated._id && c._id === updated._id) || c === updated) {
                    arr[i] = updated;
                    return true;
                }
                if (Array.isArray(c.children) && replaceIn(c.children)) return true;
            }
            return false;
        };

        if (replaceIn(screen.layout.children)) {
            setFlowData(next);
            setSelectedComponent(updated);
        }
    }, [flowData, selectedScreenId, setFlowData, setSelectedComponent]);

    const currentScreen = useMemo(
        () => flowData.screens?.find((s: any) => s.id === selectedScreenId) || null,
        [flowData.screens, selectedScreenId],
    );

    const isEmpty = !flowData.screens || flowData.screens.length === 0;

    return (
        <div className="relative h-full w-full">
            <style jsx global>{`
                .gutter {
                    background-color: hsl(var(--border));
                    background-repeat: no-repeat;
                    background-position: 50%;
                    cursor: col-resize;
                }
                .gutter:hover { background-color: hsl(var(--primary) / 0.5); }
            `}</style>

            {isEmpty ? (
                <div className="flex h-full flex-col items-center justify-center bg-muted/20">
                    <div className="space-y-4 text-center">
                        <div className="mb-4 inline-block rounded-full bg-background p-4 shadow-sm">
                            <Layers className="h-10 w-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">Start building your Flow</h2>
                        <p className="mx-auto max-w-sm text-muted-foreground">
                            Add your first screen. Each screen is a page in the flow; the palette on the
                            left lets you drop components onto it.
                        </p>
                        <Button size="lg" onClick={handleAddScreen} className="mt-4">
                            <Plus className="mr-2 h-5 w-5" /> Add screen
                        </Button>
                    </div>
                </div>
            ) : (
                <Split
                    className="flex h-full"
                    sizes={[24, 46, 30]}
                    minSize={220}
                    expandToMin={false}
                    gutterSize={6}
                    gutterAlign="center"
                    snapOffset={30}
                    dragInterval={1}
                    direction="horizontal"
                    cursor="col-resize"
                >
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
                            onPublish={onPublish}
                        />
                    </div>

                    <div className="relative h-full overflow-hidden border-l border-r bg-background">
                        <MetaFlowCanvas
                            flowData={flowData}
                            setFlowData={setFlowData}
                            selectedScreenId={selectedScreenId}
                        />
                    </div>

                    <div className="relative h-full overflow-hidden bg-background">
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
