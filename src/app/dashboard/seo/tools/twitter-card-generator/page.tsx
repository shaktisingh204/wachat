'use client';

import { Button, Input, Label, Textarea, Card } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

type CardType = 'summary' | 'summary_large_image' | 'player' | 'app';

export default function TwitterCardGeneratorPage() {
  const [f, setF] = useState({
    card: 'summary_large_image' as CardType,
    site: '',
    creator: '',
    title: 'Your Page Title',
    description: 'A brief description of the page content that will appear in the Twitter card.',
    image: 'https://placehold.co/1200x630/png',
    imageAlt: '',
    playerUrl: '',
    playerWidth: '',
    playerHeight: '',
    playerStream: '',
    appCountry: '',
    appIphoneName: '',
    appIphoneId: '',
    appIphoneUrl: '',
    appIpadName: '',
    appIpadId: '',
    appIpadUrl: '',
    appGoogleplayName: '',
    appGoogleplayId: '',
    appGoogleplayUrl: '',
  });

  const update = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const out = useMemo(() => [
    f.card && `<meta name="twitter:card" content="${f.card}" />`,
    f.site && `<meta name="twitter:site" content="${f.site}" />`,
    f.creator && (f.card === 'summary' || f.card === 'summary_large_image') && `<meta name="twitter:creator" content="${f.creator}" />`,
    f.title && (f.card !== 'app') && `<meta name="twitter:title" content="${f.title}" />`,
    f.description && `<meta name="twitter:description" content="${f.description}" />`,
    f.image && (f.card !== 'app') && `<meta name="twitter:image" content="${f.image}" />`,
    f.imageAlt && (f.card !== 'app') && `<meta name="twitter:image:alt" content="${f.imageAlt}" />`,
    
    // Player
    f.playerUrl && f.card === 'player' && `<meta name="twitter:player" content="${f.playerUrl}" />`,
    f.playerWidth && f.card === 'player' && `<meta name="twitter:player:width" content="${f.playerWidth}" />`,
    f.playerHeight && f.card === 'player' && `<meta name="twitter:player:height" content="${f.playerHeight}" />`,
    f.playerStream && f.card === 'player' && `<meta name="twitter:player:stream" content="${f.playerStream}" />`,

    // App
    f.appCountry && f.card === 'app' && `<meta name="twitter:app:country" content="${f.appCountry}" />`,
    f.appIphoneName && f.card === 'app' && `<meta name="twitter:app:name:iphone" content="${f.appIphoneName}" />`,
    f.appIphoneId && f.card === 'app' && `<meta name="twitter:app:id:iphone" content="${f.appIphoneId}" />`,
    f.appIphoneUrl && f.card === 'app' && `<meta name="twitter:app:url:iphone" content="${f.appIphoneUrl}" />`,
    f.appIpadName && f.card === 'app' && `<meta name="twitter:app:name:ipad" content="${f.appIpadName}" />`,
    f.appIpadId && f.card === 'app' && `<meta name="twitter:app:id:ipad" content="${f.appIpadId}" />`,
    f.appIpadUrl && f.card === 'app' && `<meta name="twitter:app:url:ipad" content="${f.appIpadUrl}" />`,
    f.appGoogleplayName && f.card === 'app' && `<meta name="twitter:app:name:googleplay" content="${f.appGoogleplayName}" />`,
    f.appGoogleplayId && f.card === 'app' && `<meta name="twitter:app:id:googleplay" content="${f.appGoogleplayId}" />`,
    f.appGoogleplayUrl && f.card === 'app' && `<meta name="twitter:app:url:googleplay" content="${f.appGoogleplayUrl}" />`,

  ].filter(Boolean).join('\n'), [f]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(out);
    toast.success('Copied to clipboard!');
  };

  return (
    <ToolShell title="Twitter Card Generator" description="Generate Twitter/X Card meta tags with live visual preview.">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Card Configuration</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Card Type</Label>
                <select 
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-zoru-line bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-zoru-surface placeholder:text-zoru-ink-muted focus:outline-none focus:ring-1 focus:ring-zoru-line disabled:cursor-not-allowed disabled:opacity-50" 
                  value={f.card} 
                  onChange={(e) => update('card', e.target.value as CardType)}
                >
                  <option value="summary">Summary</option>
                  <option value="summary_large_image">Summary Large Image</option>
                  <option value="player">Player</option>
                  <option value="app">App</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Site (@handle)</Label>
                  <Input value={f.site} onChange={(e) => update('site', e.target.value)} placeholder="@yourhandle" />
                </div>
                {(f.card === 'summary' || f.card === 'summary_large_image') && (
                  <div className="space-y-1">
                    <Label>Creator (@handle)</Label>
                    <Input value={f.creator} onChange={(e) => update('creator', e.target.value)} placeholder="@creatorhandle" />
                  </div>
                )}
              </div>

              {f.card !== 'app' && (
                <>
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={f.title} onChange={(e) => update('title', e.target.value)} placeholder="Max 70 characters" />
                  </div>
                  
                  <div className="space-y-1">
                    <Label>Image URL</Label>
                    <Input value={f.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/image.jpg" />
                  </div>

                  <div className="space-y-1">
                    <Label>Image Alt Text</Label>
                    <Input value={f.imageAlt} onChange={(e) => update('imageAlt', e.target.value)} placeholder="Description of the image" />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={f.description} onChange={(e) => update('description', e.target.value)} placeholder="Max 200 characters" rows={3} />
              </div>
            </div>

            {f.card === 'player' && (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm">Player Configuration</h4>
                <div className="space-y-1">
                  <Label>Player URL (iframe)</Label>
                  <Input value={f.playerUrl} onChange={(e) => update('playerUrl', e.target.value)} placeholder="https://example.com/player" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Width</Label>
                    <Input type="number" value={f.playerWidth} onChange={(e) => update('playerWidth', e.target.value)} placeholder="e.g. 435" />
                  </div>
                  <div className="space-y-1">
                    <Label>Height</Label>
                    <Input type="number" value={f.playerHeight} onChange={(e) => update('playerHeight', e.target.value)} placeholder="e.g. 251" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Stream URL (optional)</Label>
                  <Input value={f.playerStream} onChange={(e) => update('playerStream', e.target.value)} placeholder="Raw stream URL" />
                </div>
              </div>
            )}

            {f.card === 'app' && (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm">App Configuration</h4>
                <div className="space-y-1">
                  <Label>App Country (Optional)</Label>
                  <Input value={f.appCountry} onChange={(e) => update('appCountry', e.target.value)} placeholder="US" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* iPhone */}
                  <div className="space-y-3 p-3 bg-zoru-surface-2/30 rounded-lg">
                    <h5 className="text-xs font-semibold uppercase">iPhone App</h5>
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-sm" value={f.appIphoneName} onChange={(e) => update('appIphoneName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ID</Label>
                      <Input className="h-8 text-sm" value={f.appIphoneId} onChange={(e) => update('appIphoneId', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">URL Scheme</Label>
                      <Input className="h-8 text-sm" value={f.appIphoneUrl} onChange={(e) => update('appIphoneUrl', e.target.value)} />
                    </div>
                  </div>

                  {/* iPad */}
                  <div className="space-y-3 p-3 bg-zoru-surface-2/30 rounded-lg">
                    <h5 className="text-xs font-semibold uppercase">iPad App</h5>
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-sm" value={f.appIpadName} onChange={(e) => update('appIpadName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ID</Label>
                      <Input className="h-8 text-sm" value={f.appIpadId} onChange={(e) => update('appIpadId', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">URL Scheme</Label>
                      <Input className="h-8 text-sm" value={f.appIpadUrl} onChange={(e) => update('appIpadUrl', e.target.value)} />
                    </div>
                  </div>

                  {/* Google Play */}
                  <div className="space-y-3 p-3 bg-zoru-surface-2/30 rounded-lg">
                    <h5 className="text-xs font-semibold uppercase">Google Play App</h5>
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-sm" value={f.appGoogleplayName} onChange={(e) => update('appGoogleplayName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ID</Label>
                      <Input className="h-8 text-sm" value={f.appGoogleplayId} onChange={(e) => update('appGoogleplayId', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">URL Scheme</Label>
                      <Input className="h-8 text-sm" value={f.appGoogleplayUrl} onChange={(e) => update('appGoogleplayUrl', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Visual Preview</h3>
            <div className="border border-zoru-line dark:border-zoru-line rounded-xl overflow-hidden bg-white dark:bg-black w-full max-w-sm mx-auto shadow-sm">
              <TwitterCardPreview state={f} />
            </div>
            <p className="text-xs text-zoru-ink-muted text-center">
              Note: This is an approximation. Twitter may render cards slightly differently on various devices and platforms.
            </p>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Generated Tags</h3>
              <Button size="sm" variant="outline" onClick={copyToClipboard} className="h-8">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            <div className="relative">
              <Textarea 
                readOnly 
                value={out} 
                className="min-h-[250px] font-mono text-xs bg-zoru-surface-2/50 resize-none" 
              />
            </div>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}

function TwitterCardPreview({ state }: { state: any }) {
  const domain = state.site ? state.site.replace('@', '') : 'example.com';
  
  if (state.card === 'summary') {
    return (
      <div className="flex flex-row p-0">
        <div className="w-[125px] h-[125px] shrink-0 bg-zoru-surface-2 border-r border-zoru-line dark:border-zoru-line overflow-hidden relative">
          {state.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={state.image} alt={state.imageAlt || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zoru-ink-muted text-xs">Image</div>
          )}
        </div>
        <div className="p-3 flex flex-col justify-center flex-1 min-w-0">
          <div className="text-sm font-bold truncate text-black dark:text-white leading-tight mb-1">{state.title || 'Page Title'}</div>
          <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted line-clamp-2 leading-snug mb-1">{state.description || 'Page description will appear here...'}</div>
          <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted flex items-center gap-1 mt-auto">
            <span className="w-3 h-3 rounded-full bg-zoru-surface-2 dark:bg-zoru-ink flex-shrink-0"></span>
            {domain}
          </div>
        </div>
      </div>
    );
  }
  
  if (state.card === 'summary_large_image' || state.card === 'player') {
    return (
      <div className="flex flex-col p-0">
        <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 border-b border-zoru-line dark:border-zoru-line overflow-hidden relative">
          {state.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={state.image} alt={state.imageAlt || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zoru-ink-muted text-xs">Hero Image</div>
          )}
          {state.card === 'player' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-black border-b-[8px] border-b-transparent ml-1"></div>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col">
          <div className="text-sm font-bold truncate text-black dark:text-white leading-tight mb-1">{state.title || 'Page Title'}</div>
          <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted line-clamp-2 leading-snug mb-1">{state.description || 'Page description will appear here...'}</div>
          <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted flex items-center gap-1 mt-1">
            <span className="w-3 h-3 rounded-full bg-zoru-surface-2 dark:bg-zoru-ink flex-shrink-0"></span>
            {domain}
          </div>
        </div>
      </div>
    );
  }

  if (state.card === 'app') {
    return (
      <div className="flex flex-col p-0">
        <div className="p-4 border-b border-zoru-line dark:border-zoru-line flex items-center gap-3">
          <div className="w-16 h-16 bg-zoru-surface-2 rounded-xl flex-shrink-0 overflow-hidden">
            {state.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={state.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zoru-ink-muted text-[10px]">App Icon</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold truncate text-black dark:text-white leading-tight mb-1">
              {state.appIphoneName || state.appIpadName || state.appGoogleplayName || 'App Name'}
            </div>
            <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted line-clamp-2 leading-snug">
              {state.description || 'App description will appear here...'}
            </div>
          </div>
        </div>
        <div className="p-3 flex justify-between items-center bg-zoru-surface-2 dark:bg-zoru-ink">
          <div className="text-xs text-zoru-ink dark:text-zoru-ink-muted font-medium">Get the app</div>
          <div className="px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold">
            View
          </div>
        </div>
      </div>
    );
  }

  return null;
}
