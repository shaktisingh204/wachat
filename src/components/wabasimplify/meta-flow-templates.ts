
export const flowCategories = [
    { id: 'LEAD_GENERATION', name: 'Lead Generation', description: 'For collecting user information like name, phone, email, preferences, etc. Common in ads and sign-up.' },
    { id: 'CUSTOMER_SUPPORT', name: 'Customer Support', description: 'For structured support interactions, like selecting issue type, entering order ID, etc.' },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking', description: 'For booking/rescheduling appointments or time slots. Often used in clinics, salons, etc.' },
    { id: 'PRODUCT_RECOMMENDATION', name: 'Product Recommendation', description: 'Helps users select or configure a product (e.g., choose a phone model, size, etc.).' },
    { id: 'ORDER_TRACKING', name: 'Order Tracking', description: 'Allows users to input order details and get delivery status or updates.' },
    { id: 'ONBOARDING', name: 'Onboarding', description: 'Multi-step guidance for new users (e.g., app signup, product setup, etc.).' },
    { id: 'FEEDBACK_COLLECTION', name: 'Feedback Collection', description: 'Survey-style flows to gather user feedback, ratings, or suggestions.' },
    { id: 'APPLICATION_PROCESS', name: 'Application Process', description: 'Step-by-step input for job or service applications (e.g., loan, credit card, etc.).' },
    { id: 'SUBSCRIPTION_MANAGEMENT', name: 'Subscription Management', description: 'Lets users opt-in/out of updates, notifications, or newsletters.' },
    { id: 'SURVEY', name: 'Survey', description: 'Simple questionnaire for research, customer satisfaction, or reviews.' },
    { id: 'SIGN_UP', name: 'Sign Up', description: 'A form for user registration.' },
    { id: 'SIGN_IN', name: 'Sign In', description: 'A form for user login.' },
    { id: 'CUSTOM', name: 'Custom', description: 'Use this if your flow doesn\'t fit a standard category. It gives full flexibility.' },
    { id: 'OTHER', name: 'Other', description: 'A general-purpose category.' },
];

export const uiComponents = [
    { type: 'TextHeading', label: 'Heading Text' },
    { type: 'TextBody', label: 'Body Text' },
    { type: 'Image', label: 'Image' },
    { type: 'TextInput', label: 'Text Input' },
    { type: 'DatePicker', label: 'Date Picker' },
    { type: 'RadioButtons', label: 'Radio Buttons' },
    { type: 'CheckboxGroup', label: 'Checkbox Group' },
    { type: 'Dropdown', label: 'Dropdown' },
    { type: 'OptIn', label: 'Opt-In Checkbox' },
];

const createScreen = (id, title, children) => ({
    id,
    title,
    layout: {
        type: 'SingleColumnLayout',
        children: [...children, { type: 'Footer', label: 'Continue', 'on-click-action': { name: 'next', payload: {} } }]
    }
});
const createTerminalScreen = (id, title, children) => ({
    id,
    title,
    terminal: true,
    success: true,
    layout: {
        type: 'SingleColumnLayout',
        children: [...children, { type: 'Footer', label: 'Complete', 'on-click-action': { name: 'complete' } }]
    }
});

const defaultScreens = [createTerminalScreen('WELCOME_SCREEN', 'Welcome', [{ type: 'TextHeading', text: 'Hello World!' }])];

const feedbackScreens = [
    createScreen('FEEDBACK_SCREEN', 'Feedback', [
        { type: 'TextHeading', text: 'How would you rate us?' },
        { type: 'RadioButtons', name: 'rating', 'data-source': [{ id: '5', title: 'Excellent' }, { id: '4', title: 'Good' }, { id: '3', 'title': 'Okay' }] },
        { type: 'TextInput', label: 'Comments', name: 'comments' }
    ]),
    createTerminalScreen('THANK_YOU_SCREEN', 'Thank You', [{ type: 'TextHeading', text: 'Thanks for your feedback!' }])
];
feedbackScreens[0].layout.children.find(c => c.type === 'Footer')['on-click-action'].payload.next = 'THANK_YOU_SCREEN';


const appointmentScreens = [
    createScreen('APPOINTMENT_SCREEN', 'Book Appointment', [
        { type: 'TextHeading', text: 'Book an Appointment' },
        { type: 'DatePicker', name: 'appointment_date', label: 'Select a Date' },
        { type: 'Dropdown', name: 'appointment_time', label: 'Select a Time', 'data-source': [{id: '0900', title: '09:00 AM'}] }
    ]),
    createTerminalScreen('CONFIRMATION_SCREEN', 'Confirmation', [{ type: 'TextHeading', text: 'Your appointment is confirmed!' }])
];
appointmentScreens[0].layout.children.find(c => c.type === 'Footer')['on-click-action'].payload.next = 'CONFIRMATION_SCREEN';


const leadgenScreens = [
     createScreen('LEAD_GEN_SCREEN', 'Get a Quote', [
        { type: 'TextHeading', text: 'Get a Free Quote' },
        { type: 'TextInput', label: 'Full Name', name: 'full_name' },
        { type: 'TextInput', label: 'Email Address', name: 'email', 'input-type': 'email' }
    ]),
    createTerminalScreen('LEAD_GEN_THANKS', 'Thank You', [{ type: 'TextHeading', text: 'Thanks! We will contact you shortly.' }])
];
leadgenScreens[0].layout.children.find(c => c.type === 'Footer')['on-click-action'].payload.next = 'LEAD_GEN_THANKS';


export const getTemplateScreens = (templateId: string) => {
    switch (templateId) {
        case 'default': return defaultScreens;
        case 'feedback': return feedbackScreens;
        case 'appointment': return appointmentScreens;
        case 'endpoint-leadgen': return leadgenScreens;
        default: return defaultScreens;
    }
};
