
export type DeclarativeUIComponent = {
    type: 'TextHeading' | 'TextSubheading' | 'TextBody' | 'TextCaption' | 'TextInput' | 'TextArea' | 'DatePicker' | 'CalendarPicker' | 'Dropdown' | 'RadioButtonsGroup' | 'CheckboxGroup' | 'ChipsSelector' | 'PhotoPicker' | 'DocumentPicker' | 'Image' | 'ImageCarousel' | 'OptIn' | 'EmbeddedLink' | 'Footer' | 'If' | 'Switch' | 'NavigationList';
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
    // Display
    { type: 'TextHeading', label: 'Heading' },
    { type: 'TextSubheading', label: 'Subheading' },
    { type: 'TextBody', label: 'Body Text' },
    { type: 'TextCaption', label: 'Caption Text' },
    { type: 'Image', label: 'Image' },
    { type: 'ImageCarousel', label: 'Image Carousel' },
    
    // Inputs
    { type: 'TextInput', label: 'Text Input' },
    { type: 'TextArea', label: 'Text Area' },
    { type: 'Dropdown', label: 'Dropdown' },
    { type: 'RadioButtonsGroup', label: 'Radio Buttons' },
    { type: 'CheckboxGroup', label: 'Checkboxes' },
    { type: 'ChipsSelector', label: 'Chips Selector' },
    { type: 'DatePicker', label: 'Date Picker' },
    { type: 'CalendarPicker', label: 'Calendar' },
    { type: 'PhotoPicker', label: 'Photo Picker' },
    { type: 'DocumentPicker', label: 'Document Picker' },
    { type: 'OptIn', label: 'Opt-In Checkbox' },

    // Actions & Navigation
    { type: 'Footer', label: 'Footer Button' },
    { type: 'EmbeddedLink', label: 'Embedded Link' },
    { type: 'NavigationList', label: 'Navigation List' },

    // Conditional
    { type: 'If', label: 'If/Else Block' },
    { type: 'Switch', label: 'Switch Block' },
];

  

