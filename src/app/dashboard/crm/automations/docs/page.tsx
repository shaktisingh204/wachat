'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const blockDocs = [
    {
        title: 'Trigger: Tag Added',
        description: 'Starts an automation when a specific tag is added to a contact.',
        properties: [
            { name: 'Tag Name', desc: 'The exact name of the tag that should trigger this workflow (e.g., "new_lead").' },
        ],
        outputs: ['One main output that connects to the first action of your automation.'],
    },
    {
        title: 'Action: Send Email',
        description: 'Sends a pre-defined email template to the contact.',
        properties: [
            { name: 'Email Template', desc: 'Select one of your saved email templates to send. You can create templates in the CRM Settings.' },
        ],
        outputs: ['One main output to continue the flow after the email is sent.'],
    },
    {
        title: 'Action: Create Task',
        description: 'Creates a new task and assigns it, typically to a user.',
        properties: [
            { name: 'Task Title', desc: 'The title of the task. You can use variables like {{contact.name}} to personalize it.' },
        ],
        outputs: ['One main output to continue the flow.'],
    },
    {
        title: 'Action: Add Tag',
        description: 'Adds a new tag to the contact.',
        properties: [
            { name: 'Tag Name', desc: 'The exact name of the tag to add.' },
        ],
        outputs: ['One main output.'],
    },
    {
        title: 'Add Delay',
        description: 'Pauses the automation for a specific amount of time.',
        properties: [
            { name: 'Delay Duration', desc: 'The number of minutes, hours, or days to wait before proceeding.' },
        ],
        outputs: ['One main output.'],
    },
    {
        title: 'Add Condition',
        description: 'Creates a branching path based on contact data.',
        properties: [
            { name: 'Check Variable', desc: 'The contact variable to check (e.g., "{{contact.status}}").' },
            { name: 'Operator', desc: 'The comparison to perform (e.g., "Equals", "Contains").' },
            { name: 'Value', desc: 'The value to compare against (e.g., "qualified").' },
        ],
        outputs: ['Yes: If the condition is true.', 'No: If the condition is false.'],
    },
];

export default function CrmAutomationDocsPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link href="/dashboard/crm/automations" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Automations
                </Link>
            </div>

            <CrmPageHeader
                title="CRM Automation Documentation"
                subtitle="A guide to building powerful, automated workflows to manage your leads and customers."
                icon={BookOpen}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Using Variables</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        Variables allow you to personalize your automations and use data dynamically.
                    </p>
                </div>
                <div className="text-[13px] text-foreground space-y-4">
                    <p>
                        Variables are placeholders for data. In the Automation builder, you use double curly braces to insert a variable, like this: <ClayBadge tone="neutral" className="font-mono">{'{{contact.name}}'}</ClayBadge>.
                    </p>
                    <p>
                        The system provides several default variables you can use in any action, such as <ClayBadge tone="neutral" className="font-mono">{'{{contact.name}}'}</ClayBadge>, <ClayBadge tone="neutral" className="font-mono">{'{{contact.email}}'}</ClayBadge>, or <ClayBadge tone="neutral" className="font-mono">{'{{deal.value}}'}</ClayBadge>.
                    </p>
                </div>
            </ClayCard>

            <Separator />

            <div>
                <h2 className="text-[20px] font-bold text-foreground">Automation Blocks</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    An overview of all available triggers and actions.
                </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
                {blockDocs.map((doc, index) => (
                     <AccordionItem value={`item-${index}`} key={index} className="border-border">
                        <AccordionTrigger className="text-[15px] font-semibold">{doc.title}</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <p className="text-[13px] text-muted-foreground">{doc.description}</p>
                             <div className="space-y-2">
                                 <h4 className="font-semibold text-foreground">Properties:</h4>
                                 <ul className="list-disc list-inside space-y-1 text-[12.5px] text-foreground">
                                     {doc.properties.map((prop, pIndex) => (
                                        <li key={pIndex}><strong>{prop.name}:</strong> {prop.desc}</li>
                                     ))}
                                 </ul>
                             </div>
                             <div className="space-y-2">
                                 <h4 className="font-semibold text-foreground">Outputs:</h4>
                                 <ul className="list-disc list-inside space-y-1 text-[12.5px] text-foreground">
                                     {doc.outputs.map((out, oIndex) => <li key={oIndex}>{out}</li>)}
                                 </ul>
                             </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
