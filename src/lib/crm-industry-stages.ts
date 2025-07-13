
const defaultStages = ['New', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

const industryStages: Record<string, string[]> = {
    "Manufacturing": ['Lead', 'Needs Analysis', 'Quotation Sent', 'Negotiation', 'Closed Won', 'Closed Lost'],
    "Retail & eCommerce": ['New Lead', 'Contacted', 'Demo Scheduled', 'Purchase', 'Upsell', 'Lost'],
    "Services (IT, Consulting, Agencies)": ['Inquiry', 'Discovery Call', 'Proposal/SOW', 'Contract Sent', 'Won', 'Lost'],
    "Construction & Real Estate": ['Prospect', 'Site Visit', 'Offer Made', 'Under Contract', 'Closed', 'Lost'],
    "Wholesale & Distribution": ['Initial Contact', 'Credit Check', 'Account Setup', 'First Order', 'Repeat Business', 'Inactive'],
    "Healthcare": ['Inquiry', 'Consultation', 'Treatment Plan', 'Scheduled', 'Completed', 'No Show'],
    "Education": ['Inquiry', 'Application Submitted', 'Accepted', 'Enrolled', 'Graduated', 'Withdrew'],
};

export function getDealStagesForIndustry(industry?: string): string[] {
    if (industry && industryStages[industry]) {
        return industryStages[industry];
    }
    return defaultStages;
}
