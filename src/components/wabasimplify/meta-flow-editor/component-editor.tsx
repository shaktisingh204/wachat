
'use client';

import { useEffect, useState } from 'react';
import { BaseEditorDialog } from './dialogs/base-editor-dialog';
import { TextInputEditor } from './dialogs/text-input-editor';
import { TextEditor } from './dialogs/text-editor';
// ... more imports will go here as other editors are created

interface ComponentEditorProps {
  component: any | null;
  onSave: (newComponent: any) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComponentEditor({ component, onSave, isOpen, onOpenChange }: ComponentEditorProps) {
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
    if (value === undefined || value === '') {
        const newState = {...localComponent};
        delete newState[key];
        setLocalComponent(newState);
    } else {
        setLocalComponent((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const renderEditorContent = () => {
    switch (localComponent.type) {
      case 'TextHeading':
      case 'TextSubheading':
      case 'TextBody':
      case 'TextCaption':
        return <TextEditor component={localComponent} updateField={updateField} />;
      
      case 'TextInput':
      case 'TextArea':
        return <TextInputEditor component={localComponent} updateField={updateField} />;

      // ... other cases for other components will be added here
      
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
