

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

export type UIComponent = {
    id?: string;
    type: 'TextHeading' | 'TextBody' | 'TextSubtext' | 'Image' | 'TextInput' | 'DatePicker' | 'RadioButtons' | 'CheckboxGroup' | 'Dropdown' | 'OptIn';
    name?: string;
    label?: string;
    text?: string;
    url?: string;
    caption?: string;
    'input-type'?: 'text' | 'number' | 'email';
    'data-source'?: { id: string, title: string }[];
};


export const uiComponents: { type: UIComponent['type'], label: string }[] = [
    { type: 'TextHeading', label: 'Heading Text' },
    { type: 'TextBody', label: 'Body Text' },
    { type: 'TextSubtext', label: 'Sub-text' },
    { type: 'Image', label: 'Image' },
    { type: 'TextInput', label: 'Text Input' },
    { type: 'DatePicker', label: 'Date Picker' },
    { type: 'RadioButtons', label: 'Radio Buttons' },
    { type: 'CheckboxGroup', label: 'Checkbox Group' },
    { type: 'Dropdown', label: 'Dropdown' },
    { type: 'OptIn', label: 'Opt-In Checkbox' },
];
