"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings2, Trash2 } from "lucide-react";

import { TextEditor } from "../dialogs/text-editor";
import { TextInputEditor } from "../dialogs/text-input-editor";
import { FooterEditor } from "../dialogs/footer-editor";
import { EmbeddedLinkEditor } from "../dialogs/embedded-link-editor";
import { NavigationListEditor } from "../dialogs/navigation-list-editor";
import { IfEditor } from "../dialogs/if-editor";
import { SwitchEditor } from "../dialogs/switch-editor";
import { DropdownEditor } from "../dialogs/dropdown-editor";
import { RadioButtonsEditor } from "../dialogs/radio-buttons-editor";
import { CheckboxGroupEditor } from "../dialogs/checkbox-group-editor";
import { ImageEditor } from "../dialogs/image-editor";
import { ChipsSelectorEditor } from "../dialogs/chips-selector-editor";
import { DatePickerEditor } from "../dialogs/date-picker-editor";
import { CalendarPickerEditor } from "../dialogs/calendar-picker-editor";
import { PhotoPickerEditor } from "../dialogs/photo-picker-editor";
import { DocumentPickerEditor } from "../dialogs/document-picker-editor";
import { OptInEditor } from "../dialogs/opt-in-editor";
import { DynamicBooleanInput } from "../shared/dynamic-boolean-input";

interface MetaFlowPropertiesProps {
    selectedScreen: any | null;
    onUpdateScreen: (updates: any) => void;
    onDeleteScreen: (screenId: string) => void;
    selectedComponent: any | null;
    onUpdateComponent: (updates: any) => void;
    onDeleteComponent: (identifier: any) => void;
    allScreens: any[];
}

export function MetaFlowProperties({
    selectedScreen,
    onUpdateScreen,
    onDeleteScreen,
    selectedComponent,
    onUpdateComponent,
    onDeleteComponent,
    allScreens,
}: MetaFlowPropertiesProps) {
    if (!selectedScreen && !selectedComponent) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
                <Settings2 className="mb-2 h-8 w-8 opacity-50" />
                <p>Select a screen or component to edit its properties.</p>
            </div>
        );
    }

    const updateComponentField = (key: string, value: any) => {
        const next = { ...selectedComponent };
        if ((value === undefined || value === '') && typeof value !== 'boolean') {
            delete next[key];
        } else {
            next[key] = value;
        }
        onUpdateComponent(next);
    };

    const updateComponentAction = (
        action: any,
        actionType: 'on-click-action' | 'on-select-action' | 'on-unselect-action' | 'on-blur-action' = 'on-click-action',
    ) => {
        const next = { ...selectedComponent, [actionType]: action };
        onUpdateComponent(next);
    };

    const renderComponentEditor = () => {
        if (!selectedComponent) return null;

        switch (selectedComponent.type) {
            // Text family — v7.3 spec: keep concrete types, don't merge into a fake "Text".
            case 'TextHeading':
            case 'TextSubheading':
            case 'TextBody':
            case 'TextCaption':
            case 'RichText':
                return <TextEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'TextInput':
            case 'TextArea':
                return <TextInputEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Footer':
                return (
                    <FooterEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={updateComponentAction}
                        allScreens={allScreens}
                    />
                );

            case 'EmbeddedLink':
                return (
                    <EmbeddedLinkEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={updateComponentAction}
                        allScreens={allScreens}
                    />
                );

            case 'NavigationList':
                return <NavigationListEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'If':
                return <IfEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Switch':
                return <SwitchEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Dropdown':
                return (
                    <DropdownEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={(a) => updateComponentAction(a, 'on-select-action')}
                    />
                );

            case 'RadioButtonsGroup':
                return (
                    <RadioButtonsEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={(a) => updateComponentAction(a, 'on-select-action')}
                    />
                );

            case 'CheckboxGroup':
                return (
                    <CheckboxGroupEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={(a) => updateComponentAction(a, 'on-select-action')}
                    />
                );

            case 'ChipsSelector':
                return (
                    <ChipsSelectorEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={(a) => updateComponentAction(a, 'on-select-action')}
                    />
                );

            case 'DatePicker':
                return <DatePickerEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'CalendarPicker':
                return <CalendarPickerEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'PhotoPicker':
                return <PhotoPickerEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'DocumentPicker':
                return <DocumentPickerEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'OptIn':
                return <OptInEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Image':
                return (
                    <ImageEditor
                        component={selectedComponent}
                        updateField={updateComponentField}
                        updateAction={updateComponentAction}
                    />
                );

            case 'ImageCarousel':
                return <ImageCarouselEditor component={selectedComponent} updateField={updateComponentField} />;

            default:
                return (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        No dedicated editor for <span className="font-mono">{selectedComponent.type}</span> yet.
                        Use the JSON tab to edit.
                    </div>
                );
        }
    };

    return (
        <div className="flex h-full flex-col border-l bg-background">
            <div className="border-b p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Settings2 className="h-4 w-4" /> Properties
                </h3>
            </div>

            <ScrollArea className="flex-1 p-4">
                {selectedComponent ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-primary">{selectedComponent.type}</h4>
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => onDeleteComponent(selectedComponent.name || selectedComponent)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <Separator />

                        <div className="space-y-4">
                            {selectedComponent.name !== undefined ? (
                                <div className="space-y-2">
                                    <Label>Component name (ID)</Label>
                                    <Input
                                        value={selectedComponent.name || ''}
                                        onChange={(e) => updateComponentField('name', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Used in <code>data</code> payload and <code>${'{form.NAME}'}</code> references.
                                    </p>
                                </div>
                            ) : null}

                            {renderComponentEditor()}
                        </div>
                    </div>
                ) : (
                    <ScreenSettings
                        selectedScreen={selectedScreen}
                        onUpdateScreen={onUpdateScreen}
                        onDeleteScreen={onDeleteScreen}
                    />
                )}
            </ScrollArea>
        </div>
    );
}

function ScreenSettings({
    selectedScreen, onUpdateScreen, onDeleteScreen,
}: {
    selectedScreen: any;
    onUpdateScreen: (s: any) => void;
    onDeleteScreen: (id: string) => void;
}) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-primary">Screen settings</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteScreen(selectedScreen.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            <Separator />

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Screen ID</Label>
                    <Input disabled value={selectedScreen.id} className="bg-muted font-mono text-xs" />
                </div>

                <div className="space-y-2">
                    <Label>Screen title</Label>
                    <Input
                        value={selectedScreen.title || ''}
                        onChange={(e) => onUpdateScreen({ ...selectedScreen, title: e.target.value })}
                        placeholder="Shown in the top nav of the screen"
                    />
                </div>

                <Separator />

                <DynamicBooleanInput
                    label="Terminal screen"
                    description="Marks this as the final screen. Meta requires exactly one."
                    value={selectedScreen.terminal}
                    onChange={(v) => onUpdateScreen({ ...selectedScreen, terminal: v || undefined })}
                />

                <DynamicBooleanInput
                    label="Success"
                    description="Only meaningful when terminal is true."
                    value={selectedScreen.success}
                    onChange={(v) => onUpdateScreen({ ...selectedScreen, success: v || undefined })}
                />

                <DynamicBooleanInput
                    label="Refresh on back"
                    description="When true, pressing back triggers a BACK data_exchange."
                    value={selectedScreen.refresh_on_back}
                    onChange={(v) => onUpdateScreen({ ...selectedScreen, refresh_on_back: v || undefined })}
                />

                <div className="space-y-2">
                    <Label>Sensitive fields (comma-separated)</Label>
                    <Input
                        value={Array.isArray(selectedScreen.sensitive) ? selectedScreen.sensitive.join(', ') : ''}
                        onChange={(e) => {
                            const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            onUpdateScreen({ ...selectedScreen, sensitive: arr.length ? arr : undefined });
                        }}
                        placeholder="ssn, card_number"
                        className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Values marked sensitive aren't cached on the client for session restore.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Minimal inline editor for ImageCarousel (v7.1+).
 * Each image: { src (base64, required), alt-text (required) }.
 */
function ImageCarouselEditor({
    component, updateField,
}: { component: any; updateField: (k: string, v: any) => void }) {
    const images: any[] = Array.isArray(component.images) ? component.images : [];

    const updateImage = (idx: number, patch: Record<string, any>) => {
        const next = images.map((img, i) => i === idx ? { ...img, ...patch } : img);
        updateField('images', next);
    };
    const addImage = () => updateField('images', [...images, { src: '', 'alt-text': '' }]);
    const removeImage = (idx: number) => updateField('images', images.filter((_, i) => i !== idx));

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Aspect ratio</Label>
                    <select
                        value={component['aspect-ratio'] || '4:3'}
                        onChange={(e) => updateField('aspect-ratio', e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                    >
                        <option value="4:3">4:3</option>
                        <option value="16:9">16:9</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label>Scale type</Label>
                    <select
                        value={component['scale-type'] || 'cover'}
                        onChange={(e) => updateField('scale-type', e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                    >
                        <option value="cover">cover</option>
                        <option value="contain">contain</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Images ({images.length})</Label>
                    <Button size="sm" variant="outline" onClick={addImage}>Add image</Button>
                </div>
                {images.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Paste a base64 data URI in src for each image.</p>
                ) : null}
                {images.map((img, idx) => (
                    <div key={idx} className="space-y-2 rounded-md border p-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold">Image {idx + 1}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeImage(idx)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                        <Input
                            value={img.src || ''}
                            onChange={(e) => updateImage(idx, { src: e.target.value })}
                            placeholder="Base64 data (no data:image/…; prefix)"
                            className="h-8 font-mono text-[10.5px]"
                        />
                        <Input
                            value={img['alt-text'] || ''}
                            onChange={(e) => updateImage(idx, { 'alt-text': e.target.value })}
                            placeholder="Alt text (required)"
                            className="h-8 text-xs"
                        />
                    </div>
                ))}
            </div>

            <DynamicBooleanInput
                label="Visible"
                value={component.visible}
                onChange={(v) => updateField('visible', v)}
            />
        </div>
    );
}
