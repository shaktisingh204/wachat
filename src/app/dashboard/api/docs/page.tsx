
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const wachatApiDocs = [
    {
        endpoint: 'POST /v1/wachat/messages/send',
        description: 'Send a text message to a contact.',
        bodyParams: [
            { name: 'contactId', type: 'string', desc: 'The internal ID of the contact to send to. (Required if waId is not provided)' },
            { name: 'waId', type: 'string', desc: 'The recipient\'s WhatsApp ID (phone number). (Required if contactId is not provided)' },
            { name: 'projectId', type: 'string', desc: 'The project ID to send from. (Required with waId)' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID to send from. (Required with waId)' },
            { name: 'messageText', type: 'string', desc: 'The text content of the message. (Required)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/wachat/messages/send \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contactId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "messageText": "Hello from the API!"
  }'`
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
            
            <div>
                <h2 className="text-2xl font-bold font-headline">Wachat Suite APIs</h2>
            </div>
            {wachatApiDocs.map((endpoint, i) => (
                <Card key={i}>
                    <CardHeader>
                        <CardTitle className="font-mono text-lg">{endpoint.endpoint}</CardTitle>
                        <CardDescription>{endpoint.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold mb-2">Request Body Parameters</h4>
                        <div className="border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr className="border-b">
                                        <th className="p-2 text-left">Parameter</th>
                                        <th className="p-2 text-left">Type</th>
                                        <th className="p-2 text-left">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {endpoint.bodyParams.map(param => (
                                        <tr key={param.name} className="border-b last:border-b-0">
                                            <td className="p-2 font-mono">{param.name}</td>
                                            <td className="p-2 font-mono">{param.type}</td>
                                            <td className="p-2 text-muted-foreground">{param.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <h4 className="font-semibold mb-2 mt-4">Example Request</h4>
                        <CodeBlock code={endpoint.example} language="bash" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
