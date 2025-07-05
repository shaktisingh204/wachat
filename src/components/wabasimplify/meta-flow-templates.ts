

import {
  Heading1, Heading2, Pilcrow, Captions, Type, Newspaper, Calendar, CalendarDays, ChevronDownSquare, Radio, ListChecks, Tags,
  Image as ImageIcon, GalleryVertical, Camera, FileUp, Hand, Footprints, Link as LinkIcon, List as ListIcon, GitBranch, ToggleRight as SwitchIcon
} from 'lucide-react';

export type DeclarativeUIComponent = {
    type: 'TextHeading' | 'TextSubheading' | 'TextBody' | 'TextCaption' | 'TextInput' | 'TextArea' | 'DatePicker' | 'CalendarPicker' | 'Dropdown' | 'RadioButtonsGroup' | 'CheckboxGroup' | 'ChipsSelector' | 'PhotoPicker' | 'DocumentPicker' | 'Image' | 'ImageCarousel' | 'OptIn' | 'EmbeddedLink' | 'Footer' | 'If' | 'Switch' | 'NavigationList';
    label: string;
    icon: React.ElementType;
    description: string;
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

export const declarativeFlowComponents: { name: string; components: DeclarativeUIComponent[] }[] = [
    {
        name: 'Display',
        components: [
            { type: 'TextHeading', label: 'Heading', icon: Heading1, description: 'Large, bold text for titles.' },
            { type: 'TextSubheading', label: 'Subheading', icon: Heading2, description: 'Medium-sized text.' },
            { type: 'TextBody', label: 'Body Text', icon: Pilcrow, description: 'Regular paragraph text.' },
            { type: 'TextCaption', label: 'Caption Text', icon: Captions, description: 'Small, supplementary text.' },
            { type: 'Image', label: 'Image', icon: ImageIcon, description: 'Display a single static image.' },
            { type: 'ImageCarousel', label: 'Image Carousel', icon: GalleryVertical, description: 'A scrollable carousel of images.' },
        ]
    },
    {
        name: 'Inputs',
        components: [
            { type: 'TextInput', label: 'Text Input', icon: Type, description: 'A single-line text field.' },
            { type: 'TextArea', label: 'Text Area', icon: Newspaper, description: 'A multi-line text field.' },
            { type: 'Dropdown', label: 'Dropdown', icon: ChevronDownSquare, description: 'A dropdown menu for selection.' },
            { type: 'RadioButtonsGroup', label: 'Radio Buttons', icon: Radio, description: 'Select one option from a list.' },
            { type: 'CheckboxGroup', label: 'Checkboxes', icon: ListChecks, description: 'Select multiple options.' },
            { type: 'ChipsSelector', label: 'Chips Selector', icon: Tags, description: 'Select one or more choices as chips.' },
            { type: 'DatePicker', label: 'Date Picker', icon: Calendar, description: 'A simple date selection input.' },
            { type: 'CalendarPicker', label: 'Calendar', icon: CalendarDays, description: 'An inline calendar for date/range selection.' },
            { type: 'PhotoPicker', label: 'Photo Picker', icon: Camera, description: 'Allow users to upload photos.' },
            { type: 'DocumentPicker', label: 'Document Picker', icon: FileUp, description: 'Allow users to upload documents.' },
            { type: 'OptIn', label: 'Opt-In Checkbox', icon: Hand, description: 'A checkbox for consent or terms.' },
        ]
    },
    {
        name: 'Actions & Navigation',
        components: [
            { type: 'Footer', label: 'Footer Button', icon: Footprints, description: 'The main action button for a screen.' },
            { type: 'EmbeddedLink', label: 'Embedded Link', icon: LinkIcon, description: 'An inline, clickable link.' },
            { type: 'NavigationList', label: 'Navigation List', icon: ListIcon, description: 'A rich list for navigating between screens.' },
        ]
    },
    {
        name: 'Conditional Logic',
        components: [
            { type: 'If', label: 'If/Else Block', icon: GitBranch, description: 'Conditionally show components.' },
            { type: 'Switch', label: 'Switch Block', icon: SwitchIcon, description: 'Show components based on a value.' },
        ]
    }
];
