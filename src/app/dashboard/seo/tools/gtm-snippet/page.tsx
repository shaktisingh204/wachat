'use client';

import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INIT_SNIPPETS = {
  basic: `<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'pageType': 'home',
  'userStatus': 'logged_in',
  'userId': 'USER_12345'
});
</script>`,
  ecommerce_list: `<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'ecommerce': {
    'currencyCode': 'USD',
    'impressions': [
      {
        'name': 'Triblend Android T-Shirt',
        'id': '12345',
        'price': '15.25',
        'brand': 'Google',
        'category': 'Apparel',
        'variant': 'Gray',
        'list': 'Search Results',
        'position': 1
      }
    ]
  }
});
</script>`,
  custom_event: `<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'event': 'custom_event_name',
  'eventCategory': 'category',
  'eventAction': 'action',
  'eventLabel': 'label'
});
</script>`,
};

const ECOMMERCE_SNIPPETS = {
  purchase: `window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: "purchase",
  ecommerce: {
    transaction_id: "T_12345",
    value: 25.42,
    tax: 4.90,
    shipping: 5.99,
    currency: "USD",
    coupon: "SUMMER_SALE",
    items: [
      {
        item_id: "SKU_12345",
        item_name: "Stan and Friends Tee",
        price: 9.99,
        quantity: 1
      }
    ]
  }
});`,
  add_to_cart: `window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: "add_to_cart",
  ecommerce: {
    currency: "USD",
    value: 7.77,
    items: [
      {
        item_id: "SKU_12345",
        item_name: "Stan and Friends Tee",
        price: 9.99,
        quantity: 1
      }
    ]
  }
});`,
  view_item: `window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: "view_item",
  ecommerce: {
    currency: "USD",
    value: 7.77,
    items: [
      {
        item_id: "SKU_12345",
        item_name: "Stan and Friends Tee",
        price: 9.99,
        quantity: 1
      }
    ]
  }
});`,
};

export default function GtmSnippetPage() {
  const [id, setId] = useState('GTM-XXXXXXX');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [snippetType, setSnippetType] = useState<keyof typeof ECOMMERCE_SNIPPETS>('purchase');
  const [initSnippetType, setInitSnippetType] = useState<keyof typeof INIT_SNIPPETS>('basic');

  const isValidFormat = /^GTM-[A-Za-z0-9]+$/.test(id.trim());
  const showValidationError = id.trim().length > 0 && !isValidFormat;

  const { head, body } = useMemo(() => {
    const safeId = (id || '').trim() || 'GTM-XXXXXXX';
    const headSnippet = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${safeId}');</script>
<!-- End Google Tag Manager -->`;
    const bodySnippet = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safeId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
    return { head: headSnippet, body: bodySnippet };
  }, [id]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const currentSnippet = ECOMMERCE_SNIPPETS[snippetType];
  const currentInitSnippet = INIT_SNIPPETS[initSnippetType];

  return (
    <ToolShell
      title="GTM Snippet Generator"
      description="Generate Google Tag Manager head and body snippets for your website."
    >
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="gtm-id">GTM Container ID</Label>
          <Input
            id="gtm-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="GTM-XXXXXXX"
          />
          {showValidationError && (
            <p className="text-destructive text-sm">
              Invalid GTM ID format. It should look like GTM-XXXXXXX.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Head snippet (paste in &lt;head&gt;)</Label>
          <Button size="sm" variant="outline" onClick={() => copy('head', head)}>
            {copiedKey === 'head' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea readOnly value={head} className="min-h-[180px] font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Body snippet (paste just after &lt;body&gt;)</Label>
          <Button size="sm" variant="outline" onClick={() => copy('body', body)}>
            {copiedKey === 'body' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea readOnly value={body} className="min-h-[120px] font-mono text-xs" />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-medium">DataLayer Initialization Templates</h3>
        <p className="text-sm text-muted-foreground">
          Use these snippets to initialize your dataLayer before the GTM container loads.
        </p>

        <div className="flex items-center space-x-4">
          <Label>Select Template:</Label>
          <Select value={initSnippetType} onValueChange={(val: keyof typeof INIT_SNIPPETS) => setInitSnippetType(val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select template..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic User Data</SelectItem>
              <SelectItem value="ecommerce_list">E-commerce Product List</SelectItem>
              <SelectItem value="custom_event">Custom Event</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Initialization Code (paste before GTM Head snippet)</Label>
            <Button size="sm" variant="outline" onClick={() => copy('init', currentInitSnippet)}>
              {copiedKey === 'init' ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Textarea readOnly value={currentInitSnippet} className="min-h-[220px] font-mono text-xs" />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-medium">E-commerce DataLayer Snippets</h3>
        <p className="text-sm text-muted-foreground">
          Use these standard snippets to push e-commerce events to the dataLayer before the GTM tag fires, or on user interactions.
        </p>

        <div className="flex items-center space-x-4">
          <Label>Select Event:</Label>
          <Select value={snippetType} onValueChange={(val: keyof typeof ECOMMERCE_SNIPPETS) => setSnippetType(val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select event..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="add_to_cart">Add to Cart</SelectItem>
              <SelectItem value="view_item">View Item</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>DataLayer Code</Label>
            <Button size="sm" variant="outline" onClick={() => copy('ecommerce', currentSnippet)}>
              {copiedKey === 'ecommerce' ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Textarea readOnly value={currentSnippet} className="min-h-[220px] font-mono text-xs" />
        </div>
      </div>
    </ToolShell>
  );
}
