
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Settings,
  Link2,
  Rocket,
  BarChart2,
  Database,
  ChevronLeft,
  ShoppingBag,
  Package,
  Key,
  DatabaseZap,
  Clipboard,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CodeBlock = ({ children }: { children: React.ReactNode }) => (
    <pre className="p-4 rounded-md bg-muted/50 text-xs font-mono overflow-x-auto relative mt-2">
        <code>{children}</code>
    </pre>
);

const coreComponents = [
    { icon: Package, component: 'Catalog', description: 'A collection of products/services, managed via Meta (not directly via WhatsApp).' },
    { icon: ShoppingBag, component: 'Product', description: 'An item in the catalog: includes name, image, price, description, etc.' },
    { icon: DatabaseZap, component: 'WABA', description: 'WhatsApp Business Account - required to use product messages.' },
    { icon: Settings, component: 'Meta Business Manager', description: 'Platform to manage catalogs, pages, permissions, and WABA.' },
    { icon: Rocket, component: 'WhatsApp Cloud API', description: 'Used to send product messages via API.' },
    { icon: Link2, component: 'Commerce Manager', description: 'Web tool to create/manage catalogs or connect to APIs.' }
];

const limits = [
    { category: 'Catalogs per Meta Business', limit: '100 (soft limit)' },
    { category: 'Products per Catalog', limit: '500' },
    { category: 'Product Messages per Multi-Product List', limit: 'Max 30 products' },
    { category: 'Product name', limit: '150 characters' },
    { category: 'Product description', limit: '5000 characters' },
    { category: 'Product image file size', limit: 'Max 8MB' },
    { category: 'Catalogs linked to WhatsApp', limit: 'Only 1 per WABA' },
    { category: 'Languages supported', limit: '30+' }
];

const permissions = [
    'catalog_management',
    'whatsapp_business_messaging',
    'business_management',
    'pages_read_engagement'
];

const bestPractices = [
    { task: 'Product images', recommendation: 'Use 1:1 ratio (e.g., 1080x1080), high quality' },
    { task: 'Naming', recommendation: 'Use descriptive titles for clarity' },
    { task: 'Categories', recommendation: 'Group in “sections” for multi-product messages' },
    { task: 'Variants', recommendation: 'Use naming like “T-Shirt – Red, L”' },
    { task: 'Stock changes', recommendation: 'Sync regularly via API or CSV feed' }
];

const roadmapSummary = [
  { phase: 1, task: 'Setup', details: 'Create Meta Business, WABA, Page' },
  { phase: 2, task: 'Catalog', details: 'Create catalog via API' },
  { phase: 3, task: 'Products', details: 'Add 1–500 products' },
  { phase: 4, task: 'Connect', details: 'Link catalog to WABA (manual)' },
  { phase: 5, task: 'Use', details: 'Send product messages via WhatsApp API' },
  { phase: 6, task: 'Maintain', details: 'Sync products, update prices, availability, etc.' },
];

const limitations = [
    'Only 1 catalog per WABA.',
    'No in-app payment system (use external methods).',
    'Product linking to WABA must be done via Meta interface.',
    'Messages must be sent by a verified business via WhatsApp Cloud API.'
];

export default function WhatsAppAdsRoadmapPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/whatsapp-ads">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Ad Management
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <ShoppingBag className="h-8 w-8" />
          WhatsApp Catalogs: Full Guide & Roadmap
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          A complete guide to integrating Meta Marketing API and WhatsApp Cloud API for a full ad-to-lead workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardHeader><CardTitle>Part 1: Core Components</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {coreComponents.map((item) => (
                            <div key={item.component} className="flex items-start gap-4">
                                <item.icon className="h-6 w-6 text-primary mt-1 flex-shrink-0"/>
                                <div>
                                    <p className="font-semibold">{item.component}</p>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Part 2: Limits</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {limits.map(item => (
                                <TableRow key={item.category}>
                                    <TableCell className="font-medium">{item.category}</TableCell>
                                    <TableCell className="text-right">{item.limit}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-8">
             <Card>
                <CardHeader><CardTitle>Part 3: System Flow</CardTitle></CardHeader>
                <CardContent className="font-mono text-sm space-y-2">
                    <p>[Graph API] --&gt; [Create Catalog]</p>
                    <p>[Graph API] --&gt; [Add/Edit Products]</p>
                    <p>[Meta Business Manager] --&gt; [Link Catalog to WABA]</p>
                    <p>[WhatsApp Cloud API] --&gt; [Send Product Message]</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Part 5: Permissions Required</CardTitle></CardHeader>
                <CardContent>
                    <ul className="list-disc pl-5 space-y-1">
                        {permissions.map(p => <li key={p}><code>{p}</code></li>)}
                    </ul>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Part 6: Best Practices</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Recommendation</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {bestPractices.map(item => (
                                <TableRow key={item.task}>
                                    <TableCell className="font-medium">{item.task}</TableCell>
                                    <TableCell>{item.recommendation}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
      
       <div className="space-y-6">
            <h2 className="text-2xl font-bold font-headline">Part 4: Setup & Roadmap</h2>
            <Card>
                <CardHeader><CardTitle>✅ STEP 1: Prerequisites</CardTitle></CardHeader>
                <CardContent>
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                        <li>A verified Meta Business Manager account.</li>
                        <li>A WhatsApp Business Account (WABA) connected to your Meta business.</li>
                        <li>A Facebook Page (required to manage catalogs).</li>
                        <li>A Meta System User with token and required permissions.</li>
                    </ul>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>🧰 STEP 2: Create a Catalog</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm">Replace <code>{'{business-id}'}</code> and <code>{'{access-token}'}</code> with your values.</p>
                    <CodeBlock>
{`POST https://graph.facebook.com/v19.0/{business-id}/owned_product_catalogs
Authorization: Bearer {access-token}

{
  "name": "My Product Catalog",
  "vertical": "commerce"
}`}
                    </CodeBlock>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>📥 STEP 3: Add Products to Catalog</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm">Repeat this for up to 500 products.</p>
                    <CodeBlock>
{`POST https://graph.facebook.com/v19.0/{catalog-id}/products
Authorization: Bearer {access-token}

{
  "retailer_id": "product001",
  "name": "T-Shirt",
  "description": "100% cotton, available in multiple colors",
  "price": "799.00 INR",
  "currency": "INR",
  "image_url": "https://yourdomain.com/images/tshirt.jpg",
  "availability": "in stock",
  "condition": "new"
}`}
                    </CodeBlock>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>🔗 STEP 4: Link Catalog to WhatsApp Business</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm">Go to 👉 <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Commerce Manager</a>. Select your catalog, then in Settings &gt; Connected Assets, link your WABA.</p>
                    <p className="text-sm font-semibold mt-2">🔒 Currently, linking must be done manually (no public API for linking).</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>💬 STEP 5: Send Product on WhatsApp</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold">Single Product Message</h4>
                        <CodeBlock>
{`POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
Authorization: Bearer {token}

{
  "messaging_product": "whatsapp",
  "to": "919XXXXXXXXX",
  "type": "product",
  "product": {
    "catalog_id": "catalog-id",
    "product_retailer_id": "product001"
  }
}`}
                        </CodeBlock>
                    </div>
                     <div>
                        <h4 className="font-semibold">Multi-Product List Message</h4>
                        <CodeBlock>
{`POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
Authorization: Bearer {token}

{
  "messaging_product": "whatsapp",
  "to": "919XXXXXXXXX",
  "type": "multi_product",
  "header": {
    "type": "text",
    "text": "Shop Now"
  },
  "body": {
    "text": "Check out our latest products!"
  },
  "footer": {
    "text": "Limited time only"
  },
  "action": {
    "catalog_id": "catalog-id",
    "sections": [
      {
        "title": "New Arrivals",
        "product_items": [
          { "product_retailer_id": "product001" },
          { "product_retailer_id": "product002" }
        ]
      }
    ]
  }
}`}
                        </CodeBlock>
                    </div>
                </CardContent>
            </Card>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
            <CardHeader><CardTitle>🧭 ROADMAP SUMMARY</CardTitle></CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Phase</TableHead><TableHead>Task</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {roadmapSummary.map(item => (
                            <TableRow key={item.phase}>
                                <TableCell className="font-bold">{item.phase}</TableCell>
                                <TableCell>{item.task}</TableCell>
                                <TableCell>{item.details}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle/>Limitations to Know</CardTitle></CardHeader>
            <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                    {limitations.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
