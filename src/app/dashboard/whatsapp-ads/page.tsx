
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Target, WandSparkles, PenSquare, BarChart3, FlaskConical, Wrench, Megaphone, ShieldCheck } from 'lucide-react';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'WhatsApp Ads Guide | Wachat',
};

const campaignPayload = `{
  "name": "Click to WhatsApp Campaign",
  "objective": "MESSAGES",
  "status": "PAUSED",
  "special_ad_categories": []
}`;

const adSetPayload = `{
  "name": "WhatsApp Ad Set",
  "campaign_id": "<CAMPAIGN_ID>",
  "daily_budget": 1000,
  "billing_event": "IMPRESSIONS",
  "optimization_goal": "LEAD_GENERATION",
  "promoted_object": {
    "custom_event_type": "LEAD"
  },
  "targeting": {
    "geo_locations": {
      "countries": ["IN"]
    },
    "age_min": 18,
    "age_max": 55
  },
  "status": "PAUSED"
}`;

const adCreativePayload = `{
  "name": "Click to WhatsApp Creative",
  "object_story_spec": {
    "page_id": "<FB_PAGE_ID>",
    "link_data": {
      "message": "Need help? Chat with us on WhatsApp!",
      "link": "https://wa.me/<NUMBER>?text=Hi%20there!",
      "call_to_action": {
        "type": "WHATSAPP_MESSAGE",
        "value": {
          "app_destination": "WHATSAPP_THREAD"
        }
      }
    }
  }
}`;

const adPayload = `{
  "name": "Click to WhatsApp Ad",
  "adset_id": "<ADSET_ID>",
  "creative": { "creative_id": "<AD_CREATIVE_ID>" },
  "status": "PAUSED"
}`;

export default function WhatsAppAdsPage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Megaphone className="h-8 w-8" />WhatsApp Ads</h1>
            <p className="text-muted-foreground mt-2 max-w-3xl">A comprehensive guide to creating "Click to WhatsApp" ads using the Meta Marketing API.</p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/>Key Concepts</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
                    <li><strong>Platform:</strong> Meta Marketing API</li>
                    <li><strong>WhatsApp Entry Point:</strong> via <code>"destination_type": "WHATSAPP_THREAD"</code> or <code>"call_to_action_type": "WHATSAPP_MESSAGE"</code></li>
                    <li><strong>Ad Type:</strong> Click to WhatsApp Ad (Message Objective)</li>
                </ul>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>1. Setup Requirements</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-foreground/90">
                    <li>WhatsApp Business Phone Number connected to a Meta Business Account</li>
                    <li>Verified Meta Business Manager</li>
                    <li>WhatsApp Connected to Facebook Page</li>
                    <li>App Review Approval for <code>ads_management</code> and <code>whatsapp_business_messaging</code></li>
                    <li>Access token with required scopes: <code>ads_management</code>, <code>business_management</code>, <code>whatsapp_business_messaging</code></li>
                </ul>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PenSquare className="h-5 w-5"/>2. Create Campaign</CardTitle>
                <CardDescription>Endpoint: <code>POST https://graph.facebook.com/v19.0/act_&lt;AD_ACCOUNT_ID&gt;/campaigns</code></CardDescription>
            </CardHeader>
            <CardContent>
                <CodeBlock code={campaignPayload} language="json" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PenSquare className="h-5 w-5"/>3. Create Ad Set (With WhatsApp CTA)</CardTitle>
                <CardDescription>Endpoint: <code>POST https://graph.facebook.com/v19.0/act_&lt;AD_ACCOUNT_ID&gt;/adsets</code></CardDescription>
            </CardHeader>
            <CardContent>
                <CodeBlock code={adSetPayload} language="json" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><WandSparkles className="h-5 w-5"/>4. Create Ad Creative with WhatsApp CTA</CardTitle>
                <CardDescription>Endpoint: <code>POST https://graph.facebook.com/v19.0/act_&lt;AD_ACCOUNT_ID&gt;/adcreatives</code></CardDescription>
            </CardHeader>
            <CardContent>
                <CodeBlock code={adCreativePayload} language="json" />
                 <Alert className="mt-4">
                    <Key className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>You must have a Facebook Page connected to your WhatsApp number.</AlertDescription>
                </Alert>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PenSquare className="h-5 w-5"/>5. Create Ad</CardTitle>
                <CardDescription>Endpoint: <code>POST https://graph.facebook.com/v19.0/act_&lt;AD_ACCOUNT_ID&gt;/ads</code></CardDescription>
            </CardHeader>
            <CardContent>
                <CodeBlock code={adPayload} language="json" />
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>6. Track and Manage</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm mb-2">Use Graph API to check delivery, results, and costs. Retrieve Insights:</p>
                    <CodeBlock code={`GET /<AD_ID>/insights?fields=clicks,impressions,spend,actions`} language="bash" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5"/>Test Tools</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
                        <li>Graph API Explorer</li>
                        <li>Ad Preview Tool</li>
                    </ul>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5"/>Notes</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
                    <li>You can also use Dynamic Ads with WhatsApp as CTA.</li>
                    <li>WhatsApp Template Messages (for follow-up) are handled via WhatsApp Cloud API separately.</li>
                </ul>
            </CardContent>
        </Card>
    </div>
  );
}
