
'use client';

import { useEffect, useState } from 'react';
import { BaseEditorDialog } from './dialogs/base-editor-dialog';
import { TextInputEditor } from './dialogs/text-input-editor';
import { TextEditor } from './dialogs/text-editor';
import { FooterEditor } from './dialogs/footer-editor';
import { EmbeddedLinkEditor } from './dialogs/embedded-link-editor';
import { NavigationListEditor } from './dialogs/navigation-list-editor';
import { IfEditor } from './dialogs/if-editor';
import { SwitchEditor } from './dialogs/switch-editor';
import { DropdownEditor } from './dialogs/dropdown-editor';
import { RadioButtonsEditor } from './dialogs/radio-buttons-editor';
import { CheckboxGroupEditor } from './dialogs/checkbox-group-editor';
import { ImageEditor } from './dialogs/image-editor';
import { ChipsSelectorEditor } from './dialogs/chips-selector-editor';
import { DatePickerEditor } from './dialogs/date-picker-editor';
import { CalendarPickerEditor } from './dialogs/calendar-picker-editor';
import { PhotoPickerEditor } from './dialogs/photo-picker-editor';
import { DocumentPickerEditor } from './dialogs/document-picker-editor';
import { OptInEditor } from './dialogs/opt-in-editor';


interface ComponentEditorProps {
  component: any | null;
  onSave: (newComponent: any) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allScreens: any[];
}

export function ComponentEditor({ component, onSave, isOpen, onOpenChange, allScreens }: ComponentEditorProps) {
  const [localComponent, setLocalComponent] = useState<any>(null);

  useEffect(() => {
    if (component) {
      setLocalComponent(JSON.parse(JSON.stringify(component)));
    }
  }, [component]);

  if (!localComponent) {
    return null;
  }

  const updateField = (key: string, value: any) => {
    if ((value === undefined || value === '') && typeof value !== 'boolean') {
        const newState = {...localComponent};
        delete newState[key];
        setLocalComponent(newState);
    } else {
        setLocalComponent((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const updateAction = (action: any, actionType: 'on-click-action' | 'on-select-action' = 'on-click-action') => {
    setLocalComponent((prev: any) => ({ ...prev, [actionType]: action }));
  }

  const renderEditorContent = () => {
    switch (localComponent.type) {
      case 'TextHeading':
      case 'TextSubheading':
      case 'TextBody':
      case 'TextCaption':
        return <TextEditor component={localComponent} updateField={updateField} />;
      
      case 'TextInput':
      case 'TextArea':
      case 'PhoneNumber':
        return <TextInputEditor component={localComponent} updateField={updateField} />;

      case 'Footer':
        return <FooterEditor component={localComponent} updateField={updateField} updateAction={updateAction} allScreens={allScreens} />;

      case 'EmbeddedLink':
        return <EmbeddedLinkEditor component={localComponent} updateField={updateField} updateAction={updateAction} allScreens={allScreens} />;

      case 'NavigationList':
        return <NavigationListEditor component={localComponent} updateField={updateField} />;
      
      case 'If':
        return <IfEditor component={localComponent} updateField={updateField} />;
      
      case 'Switch':
        return <SwitchEditor component={localComponent} updateField={updateField} />;
      
      case 'Dropdown':
        return <DropdownEditor component={localComponent} updateField={updateField} updateAction={(action) => updateAction(action, 'on-select-action')} />;

      case 'RadioButtonsGroup':
        return <RadioButtonsEditor component={localComponent} updateField={updateField} updateAction={(action) => updateAction(action, 'on-select-action')} />;

      case 'CheckboxGroup':
        return <CheckboxGroupEditor component={localComponent} updateField={updateField} updateAction={(action) => updateAction(action, 'on-select-action')} />;
      
      case 'ChipsSelector':
        return <ChipsSelectorEditor component={localComponent} updateField={updateField} updateAction={(action) => updateAction(action, 'on-select-action')} />;

      case 'DatePicker':
        return <DatePickerEditor component={localComponent} updateField={updateField} />;
        
      case 'CalendarPicker':
        return <CalendarPickerEditor component={localComponent} updateField={updateField} />;
        
      case 'PhotoPicker':
        return <PhotoPickerEditor component={localComponent} updateField={updateField} />;
        
      case 'DocumentPicker':
        return <DocumentPickerEditor component={localComponent} updateField={updateField} />;

      case 'OptIn':
        return <OptInEditor component={localComponent} updateField={updateField} />;

      case 'Image':
        return <ImageEditor component={localComponent} updateField={updateField} updateAction={updateAction} />;

      default:
        return <p>Editor for component type '{localComponent.type}' not implemented yet.</p>;
    }
  };

  return (
    <BaseEditorDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onSave={() => onSave(localComponent)}
      componentType={localComponent.type}
    >
      {renderEditorContent()}
    </BaseEditorDialog>
  );
}
