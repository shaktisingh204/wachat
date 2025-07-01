

export type DeclarativeUIComponent = {
    type: 'TextInput' | 'NumberInput' | 'UrlInput' | 'TimePicker' | 'Button' | 'PhotoPicker' | 'DocumentPicker' | 'Calendar' | 'ContactPicker' | 'ChipsSelector' | 'RadioSelector' | 'ListSelector';
    id?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    action?: { type: 'navigate' | 'submit'; target?: string };
    options?: { id: string; label: string }[];
};

export const flowCategories = [
    { id: 'LEAD_GENERATION', name: 'Lead Generation' },
    { id: 'CUSTOMER_SUPPORT', name: 'Customer Support' },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking' },
    { id: 'SURVEY', name: 'Survey' },
    { id: 'SIGN_UP', name: 'Sign Up' },
    { id: 'SIGN_IN', name: 'Sign In' },
    { id: 'CONTACT_US', name: 'Contact Us' },
    { id: 'SHOPPING', name: 'Shopping' },
    { id: 'OTHER', name: 'Other' },
];

export const declarativeFlowComponents: { type: DeclarativeUIComponent['type'], label: string }[] = [
    { type: 'TextInput', label: 'Text Input' },
    { type: 'NumberInput', label: 'Number Input' },
    { type: 'UrlInput', label: 'URL Input' },
    { type: 'TimePicker', label: 'Time Picker' },
    { type: 'Calendar', label: 'Calendar' },
    { type: 'PhotoPicker', label: 'Photo Picker' },
    { type: 'DocumentPicker', label: 'Document Picker' },
    { type: 'ContactPicker', label: 'Contact Picker' },
    { type: 'RadioSelector', label: 'Radio Selector' },
    { type: 'ChipsSelector', label: 'Chips Selector' },
    { type: 'ListSelector', label: 'List Selector' },
    { type: 'Button', label: 'Button' },
];

// --- Old V3 Layout components - can be deprecated ---

export type UIComponentV3 = {
    type: 'TextSubheading' | 'TextArea' | 'Dropdown' | 'RadioButtonsGroup' | 'CheckboxGroup' | 'OptIn' | 'Footer';
    label?: string;
    name?: string;
    text?: string;
    'data-source'?: { id: string, title: string }[];
    'on-click-action'?: any;
}

export const uiComponentsV3: { type: UIComponentV3['type'], label: string }[] = [
    { type: 'TextSubheading', label: 'Subheading' },
    { type: 'TextArea', label: 'Text Area' },
    { type: 'Dropdown', label: 'Dropdown' },
    { type: 'RadioButtonsGroup', label: 'Radio Buttons' },
    { type: 'CheckboxGroup', label: 'Checkboxes' },
    { type: 'OptIn', label: 'Opt-In Checkbox' },
]

    