
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
            { name: 'Check Variable', desc: 'The contact variable to check (e.g., {{contact.status}}).' },
            { name: 'Operator', desc: 'The comparison to perform (e.g., "Equals", "Contains").' },
            { name: 'Value', desc: 'The value to compare against (e.g., "qualified").' },
        ],
        outputs: ['Yes: If the condition is true.', 'No: If the condition is false.'],
    },
];

export default function CrmAutomationDocsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/crm/automations">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Automations
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">CRM Automation Documentation</h1>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                    A guide to building powerful, automated workflows to manage your leads and customers.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Using Variables</CardTitle>
                    <CardDescription>
                        Variables allow you to personalize your automations and use data dynamically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                    <p>
                        Variables are placeholders for data. In the Automation builder, you use double curly braces to insert a variable, like this: <Badge variant="outline" className="font-mono">{"{{contact.name}}"}</Badge>.
                    </p>
                    <p>
                        The system provides several default variables you can use in any action, such as <Badge variant="outline">{"{{contact.name}}"}</Badge>, <Badge variant="outline">{"{{contact.email}}"}</Badge>, or <Badge variant="outline">{"{{deal.value}}"}</Badge>.
                    </p>
                </CardContent>
            </Card>

            <Separator />

            <div>
                <h2 className="text-2xl font-bold font-headline">Automation Blocks</h2>
                <p className="text-muted-foreground mt-1">
                    An overview of all available triggers and actions.
                </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
                {blockDocs.map((doc, index) => (
                     <AccordionItem value={`item-${index}`} key={index}>
                        <AccordionTrigger className="text-lg font-semibold">{doc.title}</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <p className="text-base text-muted-foreground">{doc.description}</p>
                             <div className="space-y-2">
                                 <h4 className="font-semibold">Properties:</h4>
                                 <ul className="list-disc list-inside space-y-1 text-sm">
                                     {doc.properties.map((prop, pIndex) => (
                                        <li key={pIndex}><strong>{prop.name}:</strong> {prop.desc}</li>
                                     ))}
                                 </ul>
                             </div>
                             <div className="space-y-2">
                                 <h4 className="font-semibold">Outputs:</h4>
                                 <ul className="list-disc list-inside space-y-1 text-sm">
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

