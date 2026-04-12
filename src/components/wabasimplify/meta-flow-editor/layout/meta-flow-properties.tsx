
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Re-using existing editors
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
    // Screen Props
    selectedScreen: any | null;
    onUpdateScreen: (updates: any) => void;
    onDeleteScreen: (screenId: string) => void;

    // Component Props
    selectedComponent: any | null;
    onUpdateComponent: (updates: any) => void;
    onDeleteComponent: (componentName: string) => void;

    allScreens: any[];
}

export function MetaFlowProperties({
    selectedScreen,
    onUpdateScreen,
    onDeleteScreen,
    selectedComponent,
    onUpdateComponent,
    onDeleteComponent,
    allScreens
}: MetaFlowPropertiesProps) {

    if (!selectedScreen && !selectedComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Settings2 className="h-8 w-8 mb-2 opacity-50" />
                <p>Select a screen or component to edit its properties.</p>
            </div>
        );
    }

    // Prepare Component Update Wrapper
    const updateComponentField = (key: string, value: any) => {
        const newComponent = { ...selectedComponent };
        if ((value === undefined || value === '') && typeof value !== 'boolean') {
            delete newComponent[key];
        } else {
            newComponent[key] = value;
        }
        onUpdateComponent(newComponent);
    };

    const updateComponentAction = (action: any, actionType: 'on-click-action' | 'on-select-action' = 'on-click-action') => {
        const newComponent = { ...selectedComponent, [actionType]: action };
        onUpdateComponent(newComponent);
    }

    const renderComponentEditor = () => {
        if (!selectedComponent) return null;

        if (['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(selectedComponent.type)) {
            // Auto-normalize legacy types
            const oldType = selectedComponent.type;
            const normalized = { ...selectedComponent, type: 'Text' };

            if (!normalized['font-size']) {
                if (oldType === 'TextHeading') normalized['font-size'] = 'headline';
                if (oldType === 'TextSubheading') normalized['font-size'] = 'subheadline';
                if (oldType === 'TextBody') normalized['font-size'] = 'body';
                if (oldType === 'TextCaption') normalized['font-size'] = 'caption';
            }
            if (!normalized['font-weight']) {
                if (oldType === 'TextHeading') normalized['font-weight'] = 'bold';
                if (oldType === 'TextSubheading') normalized['font-weight'] = 'medium';
            }

            // Immediate update to parent state
            onUpdateComponent(normalized);
            return null; // Will re-render with new type 'Text'
        }

        if (selectedComponent.type === 'PhoneNumber') {
            // Normalize PhoneNumber to TextInput type='phone'
            const normalized = { ...selectedComponent, type: 'TextInput', 'input-type': 'phone' };
            onUpdateComponent(normalized);
            return null;
        }

        switch (selectedComponent.type) {
            case 'Text':
                return <TextEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'TextInput':
            case 'TextArea':
                return <TextInputEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Footer':
                return <FooterEditor component={selectedComponent} updateField={updateComponentField} updateAction={updateComponentAction} allScreens={allScreens} />;

            case 'EmbeddedLink':
                return <EmbeddedLinkEditor component={selectedComponent} updateField={updateComponentField} updateAction={updateComponentAction} allScreens={allScreens} />;

            case 'NavigationList':
                return <NavigationListEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'If':
                return <IfEditor component={selectedComponent} updateField={updateComponentField} />;

            case 'Switch':
                return <SwitchEditor {...({ component: selectedComponent, updateField: updateComponentField, updateAction: (() => {}) } as any)} />;

            case 'Dropdown':
                return <DropdownEditor component={selectedComponent} updateField={updateComponentField} updateAction={(action) => updateComponentAction(action, 'on-select-action')} />;

            case 'RadioButtonsGroup':
                return <RadioButtonsEditor component={selectedComponent} updateField={updateComponentField} updateAction={(action) => updateComponentAction(action, 'on-select-action')} />;

            case 'CheckboxGroup':
                return <CheckboxGroupEditor component={selectedComponent} updateField={updateComponentField} updateAction={(action) => updateComponentAction(action, 'on-select-action')} />;

            case 'ChipsSelector':
                return <ChipsSelectorEditor component={selectedComponent} updateField={updateComponentField} updateAction={(action) => updateComponentAction(action, 'on-select-action')} />;

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
                return <ImageEditor component={selectedComponent} updateField={updateComponentField} updateAction={updateComponentAction} />;

            default:
                return <p className="text-sm text-muted-foreground">Properties for type '{selectedComponent.type}' not implemented yet.</p>;
        }
    };

    return (
        <div className="flex flex-col h-full border-l bg-background">
            <div className="p-4 border-b">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Properties
                </h3>
            </div>

            <ScrollArea className="flex-1 p-4">
                {selectedComponent ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-primary">{selectedComponent.type}</h4>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteComponent(selectedComponent.name)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <Separator />

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Component Name (ID)</Label>
                                <Input disabled value={selectedComponent.name || ''} className="bg-muted font-mono text-xs" />
                                <p className="text-[10px] text-muted-foreground">Unique identifier used in data payload.</p>
                            </div>

                            {renderComponentEditor()}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-primary">Screen Settings</h4>
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
                                <Label>Screen Title</Label>
                                <Input
                                    value={selectedScreen.title}
                                    onChange={(e) => onUpdateScreen({ ...selectedScreen, title: e.target.value })}
                                />
                            </div>

                            <Separator />

                            <DynamicBooleanInput
                                label="Terminal Screen"
                                description="Check if this is a final screen (success or completion)."
                                value={selectedScreen.terminal}
                                onChange={(val) => onUpdateScreen({ ...selectedScreen, terminal: val })}
                            />

                            <DynamicBooleanInput
                                label="Success"
                                description="Mark as a success state."
                                value={selectedScreen.success}
                                onChange={(val) => onUpdateScreen({ ...selectedScreen, success: val })}
                            />
                        </div>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
