
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useParams } from 'next/navigation';

const blockDocs = [
    {
        title: 'Start',
        description: 'Every flow must begin with a Start block. This defines how the flow is triggered.',
        properties: [
            { name: 'Trigger Keywords', desc: 'A comma-separated list of words. If an incoming message contains any of these words, this flow will begin. (e.g., "help, support, menu")' },
        ],
        outputs: ['One main output that connects to the first block of your flow.'],
    },
    {
        title: 'Send Message',
        description: 'Sends a simple text message to the user.',
        properties: [
            { name: 'Message Text', desc: 'The content of the message you want to send. You can use variables here, like "Hello {{name}}".' },
        ],
        outputs: ['One main output to continue the flow after the message is sent.'],
    },
    {
        title: 'Send Image',
        description: 'Sends an image with an optional caption.',
        properties: [
            { name: 'Image URL', desc: 'A public URL for the image you want to send. Must be a direct link to a JPG or PNG file.' },
            { name: 'Caption', desc: 'Optional text that will be sent along with the image.' },
        ],
        outputs: ['One main output to continue the flow.'],
    },
    {
        title: 'Add Quick Replies',
        description: 'Sends a message with interactive Quick Reply buttons. The user\'s choice can be used to branch the flow.',
        properties: [
            { name: 'Message Text', desc: 'The text that appears above the buttons.' },
            { name: 'Quick Replies', desc: 'You can add up to 13 Quick Reply buttons. Each button press can lead to a different path in your flow.' },
        ],
        outputs: ['Each button acts as its own output path. Connect each button to a different block to create branching logic.'],
        notes: 'This block waits for the user to press a button before continuing.'
    },
    {
        title: 'Get User Input',
        description: 'Asks the user a question and saves their text response to a variable.',
        properties: [
            { name: 'Question to Ask', desc: 'The message sent to the user to prompt their input.' },
            { name: 'Save Answer to Variable', desc: 'The name of the variable where the user\'s reply will be stored (e.g., "user_name"). Do not use brackets here.' },
        ],
        outputs: ['One main output that is followed after the user provides their response.'],
        notes: 'This block waits for the user to send a text message before continuing.'
    },
    {
        title: 'Add Condition',
        description: 'Create branches in your flow based on rules and variables. This block can either check a pre-existing variable or pause the flow to wait for the user\'s next message.',
        properties: [
            { name: 'Condition Type', desc: 'Choose what to check. "Variable" checks data already saved in a variable. "User Response" pauses the flow and checks the next message the user sends.' },
            { name: 'Variable (if type is Variable)', desc: 'The variable to check, e.g., {{user_input}} or {{age}}.' },
            { name: 'Operator', desc: 'The comparison to perform: Equals, Contains, Is one of, etc.' },
            { name: 'Value', desc: 'The value to compare against. This can be a fixed value (e.g., "yes") or another variable (e.g., {{expected_answer}}).' }
        ],
        outputs: ['Yes: If the condition is true.', 'No: If the condition is false.'],
        notes: 'If you connect a button to this block, it will automatically use the button\'s text for the condition check, regardless of the "Condition Type" setting. This makes building menus very easy.'
    },
    {
        title: 'Add Delay',
        description: 'Pauses the flow for a specified number of seconds.',
        properties: [
            { name: 'Delay (seconds)', desc: 'The number of seconds to wait before proceeding.' },
            { name: 'Show typing indicator', desc: 'If checked, a "typing..." indicator will be shown to the user during the delay.' },
        ],
        outputs: ['One main output that is followed after the delay is complete.'],
    },
     {
        title: 'Call API / Webhook',
        description: 'Make a request to an external server or API and save parts of the response to variables.',
        properties: [
            { name: 'Method', desc: 'The HTTP method for the request (GET, POST, PUT).' },
            { name: 'URL', desc: 'The endpoint URL to send the request to. You can use variables here.' },
            { name: 'Headers / Body', desc: 'Provide JSON for request headers or the request body. Variables are supported.' },
            { name: 'Response to Variable Mappings', desc: 'Define how to extract data from the API response and save it to flow variables.' },
        ],
        outputs: ['One main output that is followed after the API call is complete.'],
        notes: 'In the mappings, use dot notation for the Response Path (e.g., `user.address.city` or `items[0].name`). The value found at that path will be saved to the Variable Name you provide, which you can then use as `{{your_variable_name}}` in later steps.'
    }
];

export default function FlowBuilderDocsPage() {
    const params = useParams();
    const shopId = params.shopId as string;
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}/flow-builder`}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Flow Builder
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Flow Builder Documentation</h1>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                    Welcome to the Flow Builder guide. Here you can learn about each building block and how to use them to create powerful automations for your Messenger conversations.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Using Variables</CardTitle>
                    <CardDescription>
                        Variables allow you to personalize your flows and use data dynamically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                    <p>
                        Variables are placeholders for data that can change, such as a user's name or their answer to a question. In the Flow Builder, you use double curly braces to insert a variable, like this: <Badge variant="outline" className="font-mono">{"{{name}}"}</Badge>.
                    </p>
                    <p>
                        The "Get User Input" block is the primary way to create custom variables. When you configure it to save an answer to a variable named <Badge variant="outline">color</Badge>, you can later use the user's answer by writing <Badge variant="outline" className="font-mono">{"{{color}}"}</Badge> in a "Send Message" block.
                    </p>
                    <p>
                        There are also pre-defined variables you can use: <Badge variant="outline" className="font-mono">{"{{name}}"}</Badge> (the user's Messenger profile name) and <Badge variant="outline" className="font-mono">{"{{psid}}"}</Badge> (the user's unique Page-Scoped ID).
                    </p>
                </CardContent>
            </Card>

            <Separator />

            <div>
                <h2 className="text-2xl font-bold font-headline">Flow Blocks</h2>
                <p className="text-muted-foreground mt-1">
                    An overview of all available blocks and their configurations.
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

                             {doc.notes && (
                                <div className="p-3 bg-muted/50 rounded-md text-sm border">
                                    <p><strong>Note:</strong> {doc.notes}</p>
                                </div>
                             )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
