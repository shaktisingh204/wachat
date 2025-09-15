
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const wachatApiDocs = [
    {
        endpoint: 'GET /v1/projects/list',
        description: 'Retrieves a list of all projects accessible by the API key user.',
        bodyParams: [],
        example: `curl -X GET \\
  https://yourapp.com/api/v1/projects/list \\
  -H 'Authorization: Bearer YOUR_API_KEY'`,
        response: `{
  "success": true,
  "data": [
    {
      "_id": "60d5f1b4c7b8c2a3e4f5a6b7",
      "name": "My Main Project",
      "wabaId": "1234567890"
    }
  ]
}`
    },
    {
        endpoint: 'POST /v1/contacts/create',
        description: 'Creates a new contact within a specified project.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to add the contact to.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to associate with.' },
            { name: 'name', type: 'string', desc: 'The name of the new contact.' },
            { name: 'waId', type: 'string', desc: 'The contact\'s WhatsApp ID (phone number with country code).' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/contacts/create \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "name": "Jane Doe",
    "waId": "15559876543"
  }'`,
        response: `{
  "success": true,
  "message": "Contact added successfully.",
  "contactId": "62e8c9a3b9f8d4e7f8a1b2c4"
}`
    },
    {
        endpoint: 'POST /v1/broadcasts/start',
        description: 'Starts a new broadcast campaign to a list of contacts based on tags.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to send from.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to send from.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved message template to send.' },
            { name: 'tagIds', type: 'string[]', desc: 'An array of Tag IDs. The broadcast will be sent to all contacts with these tags.' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/broadcasts/start \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "tagIds": ["60d5f1b4c7b8c2a3e4f5a6b8", "60d5f1b4c7b8c2a3e4f5a6b9"]
  }'`,
        response: `{
  "success": true,
  "message": "Broadcast successfully queued for 150 contacts. Sending will begin shortly."
}`
    },
    {
        endpoint: 'POST /v1/broadcasts/start-bulk',
        description: 'Starts a new broadcast campaign by providing a list of contacts directly in the request body.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to send from.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to send from.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved message template to send.' },
            { name: 'contacts', type: 'object[]', desc: 'An array of contact objects. Each object must have a `phone` property and can have properties for variables (e.g., `variable1`, `variable2`).' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/broadcasts/start-bulk \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "contacts": [
        { "phone": "15551112222", "variable1": "John", "variable2": "your recent order" },
        { "phone": "15553334444", "variable1": "Jane", "variable2": "your appointment" }
    ]
  }'`,
        response: `{
  "success": true,
  "message": "Broadcast successfully queued via API for 2 contacts. Sending will begin shortly."
}`
    },
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
                                
                                {endpoint.bodyParams.length > 0 && (
                                    <>
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
                                    </>
                                )}
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

    