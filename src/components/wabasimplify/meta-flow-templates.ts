
export type DeclarativeUIComponent = {
    type: 'TextInput' | 'PhoneNumber' | 'DatePicker' | 'EmbeddedLink' | 'TextSubheading' | 'TextHeading' | 'TextArea' | 'Dropdown' | 'RadioButtonsGroup' | 'Footer' | 'PhotoPicker' | 'DocumentPicker' | 'CalendarPicker' | 'ChipsSelector' | 'ImageCarousel' | 'OptIn' | 'If' | 'Switch' | 'NavigationList';
    name?: string;
    label?: string;
    text?: string;
    "on-click-action"?: { name: 'navigate' | 'complete' | 'data_exchange' | 'open_url'; next?: { type: 'screen', name: string }, payload?: Record<string, any> };
    // Add other component-specific properties here as needed by your UI logic
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
    { type: 'TextSubheading', label: 'Subheading' },
    { type: 'TextHeading', label: 'Heading' },
    { type: 'TextArea', label: 'Text Area' },
    { type: 'TextInput', label: 'Text Input' },
    { type: 'PhoneNumber', label: 'Phone Number Input' },
    { type: 'DatePicker', label: 'Date Picker' },
    { type: 'Dropdown', label: 'Dropdown' },
    { type: 'RadioButtonsGroup', label: 'Radio Buttons' },
    { type: 'ChipsSelector', label: 'Chips Selector' },
    { type: 'PhotoPicker', label: 'Photo Picker' },
    { type: 'DocumentPicker', label: 'Document Picker' },
    { type: 'CalendarPicker', label: 'Calendar' },
    { type: 'ImageCarousel', label: 'Image Carousel' },
    { type: 'OptIn', label: 'Opt-In Checkbox' },
    { type: 'EmbeddedLink', label: 'Embedded Link' },
    { type: 'Footer', label: 'Footer Button' },
];
