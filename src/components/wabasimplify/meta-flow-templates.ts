
export type UIComponent = {
    id?: string;
    type: 'TextInput' | 'NumberInput' | 'UrlInput' | 'TimePicker' | 'Button' | 'PhotoPicker' | 'DocumentPicker' | 'Calendar' | 'ContactPicker' | 'ChipsSelector' | 'RadioSelector' | 'ListSelector';
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

export const uiComponents: { type: UIComponent['type'], label: string }[] = [
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
