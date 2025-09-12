
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const wachatApiDocs = [
    {
        endpoint: 'POST /v1/messages/send-text',
        description: 'Sends a simple text message to a contact.',
        bodyParams: [
            { name: 'contactId', type: 'string', desc: 'The internal ID of the contact to send to. (Required if waId is not provided)' },
            { name: 'waId', type: 'string', desc: 'The recipient\'s WhatsApp ID (phone number). (Required if contactId is not provided)' },
            { name: 'projectId', type: 'string', desc: 'The project ID to send from. (Required with waId)' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID to send from. (Required with waId)' },
            { name: 'messageText', type: 'string', desc: 'The text content of the message. (Required)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/messages/send-text \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contactId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "messageText": "Hello from the SabNode API!"
  }'`,
        response: `{
  "success": true,
  "message": "Message sent successfully."
}`
    },
    {
        endpoint: 'POST /v1/messages/send-template',
        description: 'Sends a pre-approved message template to a contact.',
        bodyParams: [
            { name: 'contactId', type: 'string', desc: 'The ID of the contact.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved template.' },
            { name: 'headerMediaUrl', type: 'string', desc: 'URL for header media (image, video, doc), if required by the template. (Optional)' },
            { name: 'variables', type: 'object', desc: 'Key-value pairs for template variables, e.g., {"1": "John", "2": "Order #555"}. (Optional)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/messages/send-template \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contactId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "variables": {
      "1": "David",
      "2": "your recent order"
    }
  }'`,
        response: `{
  "success": true,
  "message": "Template message sent successfully."
}`
    },
     {
        endpoint: 'POST /v1/templates/create',
        description: 'Creates a new message template for submission to Meta.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to create the template for.' },
            { name: 'name', type: 'string', desc: 'Template name (lowercase, numbers, underscores). e.g., order_confirmation_v2' },
            { name: 'category', type: "'MARKETING' | 'UTILITY'", desc: 'The template category.' },
            { name: 'language', type: 'string', desc: 'Language code. e.g., en_US' },
            { name: 'body', type: 'string', desc: 'The main message content. Use {{1}}, {{2}} for variables.' },
            { name: 'headerFormat', type: "'NONE' | 'TEXT' | 'IMAGE' | ...", desc: 'Type of header. (Optional)' },
            { name: 'headerText', type: 'string', desc: 'Text for TEXT header. (Conditional)' },
            { name: 'buttons', type: 'object[]', desc: 'Array of button objects (QUICK_REPLY or URL). (Optional)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/templates/create \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "name": "new_promo_template",
    "category": "MARKETING",
    "language": "en_US",
    "body": "Hi {{1}}, check out our new summer sale!",
    "buttons": [{ "type": "URL", "text": "Shop Now", "url": "https://example.com/sale" }]
  }'`,
        response: `{
  "success": true,
  "message": "Template 'new_promo_template' submitted successfully!"
}`
    }
];

export default function ApiDocsPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
             <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/api">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to API Keys
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <BookOpen className="h-8 w-8" />
                    API Documentation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Integrate your applications with SabNode using our REST API.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                        Authenticate your API requests by including your API key in the `Authorization` header.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodeBlock code={`Authorization: Bearer YOUR_API_KEY`} language="bash" />
                    <p className="text-sm text-muted-foreground mt-2">You can generate API keys from the <Link href="/dashboard/api" className="text-primary hover:underline">API settings page</Link>.</p>
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                <h2 className="text-2xl font-bold font-headline">Wachat Suite APIs</h2>
                 <Accordion type="single" collapsible className="w-full">
                    {wachatApiDocs.map((endpoint, i) => (
                        <AccordionItem value={`item-${i}`} key={i}>
                            <AccordionTrigger className="text-left">
                                <span className="font-mono text-sm text-primary">{endpoint.endpoint}</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                 <p className="text-muted-foreground">{endpoint.description}</p>
                                
                                <h4 className="font-semibold">Request Body Parameters</h4>
                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Parameter</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Description</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {endpoint.bodyParams.map(param => (
                                                <TableRow key={param.name}>
                                                    <TableCell className="font-mono">{param.name}</TableCell>
                                                    <TableCell className="font-mono text-xs">{param.type}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">{param.desc}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <h4 className="font-semibold">Example Request</h4>
                                <CodeBlock code={endpoint.example} language="bash" />
                                 <h4 className="font-semibold">Example Response</h4>
                                <CodeBlock code={endpoint.response} language="json" />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}

