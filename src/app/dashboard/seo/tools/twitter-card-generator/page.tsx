'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Copy } from 'lucide-react';

type CardType = 'summary' | 'summary_large_image' | 'player' | 'app';

export default function TwitterCardGeneratorPage() {
  const { toast } = useToast();
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
    toast.success('Copied to clipboard');
  };

  return (
    <ToolShell title="Twitter Card Generator" description="Generate Twitter/X Card meta tags with live visual preview.">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Card Configuration</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Card Type">
                <Select value={f.card} onValueChange={(v) => update('card', v as CardType)}>
                  <SelectTrigger aria-label="Card type">
                    <SelectValue placeholder="Select a card type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="app">App</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Site (@handle)">
                  <Input value={f.site} onChange={(e) => update('site', e.target.value)} placeholder="@yourhandle" />
                </Field>
                {(f.card === 'summary' || f.card === 'summary_large_image') && (
                  <Field label="Creator (@handle)">
                    <Input value={f.creator} onChange={(e) => update('creator', e.target.value)} placeholder="@creatorhandle" />
                  </Field>
                )}
              </div>

              {f.card !== 'app' && (
                <>
                  <Field label="Title">
                    <Input value={f.title} onChange={(e) => update('title', e.target.value)} placeholder="Max 70 characters" />
                  </Field>

                  <Field label="Image URL">
                    <Input value={f.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/image.jpg" />
                  </Field>

                  <Field label="Image Alt Text">
                    <Input value={f.imageAlt} onChange={(e) => update('imageAlt', e.target.value)} placeholder="Description of the image" />
                  </Field>
                </>
              )}

              <Field label="Description">
                <Textarea value={f.description} onChange={(e) => update('description', e.target.value)} placeholder="Max 200 characters" rows={3} />
              </Field>

              {f.card === 'player' && (
                <div className="space-y-4 pt-4 border-t border-[var(--st-border)]">
                  <h4 className="font-medium text-sm text-[var(--st-text)]">Player Configuration</h4>
                  <Field label="Player URL (iframe)">
                    <Input value={f.playerUrl} onChange={(e) => update('playerUrl', e.target.value)} placeholder="https://example.com/player" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Width">
                      <Input type="number" value={f.playerWidth} onChange={(e) => update('playerWidth', e.target.value)} placeholder="e.g. 435" />
                    </Field>
                    <Field label="Height">
                      <Input type="number" value={f.playerHeight} onChange={(e) => update('playerHeight', e.target.value)} placeholder="e.g. 251" />
                    </Field>
                  </div>
                  <Field label="Stream URL (optional)">
                    <Input value={f.playerStream} onChange={(e) => update('playerStream', e.target.value)} placeholder="Raw stream URL" />
                  </Field>
                </div>
              )}

              {f.card === 'app' && (
                <div className="space-y-4 pt-4 border-t border-[var(--st-border)]">
                  <h4 className="font-medium text-sm text-[var(--st-text)]">App Configuration</h4>
                  <Field label="App Country (Optional)">
                    <Input value={f.appCountry} onChange={(e) => update('appCountry', e.target.value)} placeholder="US" />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* iPhone */}
                    <div className="space-y-3 p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)]">
                      <h5 className="text-xs font-semibold uppercase text-[var(--st-text)]">iPhone App</h5>
                      <Field label="Name">
                        <Input inputSize="sm" value={f.appIphoneName} onChange={(e) => update('appIphoneName', e.target.value)} />
                      </Field>
                      <Field label="ID">
                        <Input inputSize="sm" value={f.appIphoneId} onChange={(e) => update('appIphoneId', e.target.value)} />
                      </Field>
                      <Field label="URL Scheme">
                        <Input inputSize="sm" value={f.appIphoneUrl} onChange={(e) => update('appIphoneUrl', e.target.value)} />
                      </Field>
                    </div>

                    {/* iPad */}
                    <div className="space-y-3 p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)]">
                      <h5 className="text-xs font-semibold uppercase text-[var(--st-text)]">iPad App</h5>
                      <Field label="Name">
                        <Input inputSize="sm" value={f.appIpadName} onChange={(e) => update('appIpadName', e.target.value)} />
                      </Field>
                      <Field label="ID">
                        <Input inputSize="sm" value={f.appIpadId} onChange={(e) => update('appIpadId', e.target.value)} />
                      </Field>
                      <Field label="URL Scheme">
                        <Input inputSize="sm" value={f.appIpadUrl} onChange={(e) => update('appIpadUrl', e.target.value)} />
                      </Field>
                    </div>

                    {/* Google Play */}
                    <div className="space-y-3 p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)]">
                      <h5 className="text-xs font-semibold uppercase text-[var(--st-text)]">Google Play App</h5>
                      <Field label="Name">
                        <Input inputSize="sm" value={f.appGoogleplayName} onChange={(e) => update('appGoogleplayName', e.target.value)} />
                      </Field>
                      <Field label="ID">
                        <Input inputSize="sm" value={f.appGoogleplayId} onChange={(e) => update('appGoogleplayId', e.target.value)} />
                      </Field>
                      <Field label="URL Scheme">
                        <Input inputSize="sm" value={f.appGoogleplayUrl} onChange={(e) => update('appGoogleplayUrl', e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visual Preview</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="border border-[var(--st-border)] rounded-xl overflow-hidden bg-white dark:bg-black w-full max-w-sm mx-auto shadow-sm">
                <TwitterCardPreview state={f} />
              </div>
              <p className="text-xs text-[var(--st-text-secondary)] text-center">
                Note: This is an approximation. Twitter may render cards slightly differently on various devices and platforms.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Generated Tags</CardTitle>
              <Button size="sm" variant="outline" onClick={copyToClipboard} iconLeft={Copy}>
                Copy
              </Button>
            </CardHeader>
            <CardBody>
              <Textarea
                readOnly
                value={out}
                rows={12}
                className="min-h-[250px] font-mono text-xs resize-none"
              />
            </CardBody>
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
        <div className="w-[125px] h-[125px] shrink-0 bg-[var(--st-bg-secondary)] border-r border-[var(--st-border)] overflow-hidden relative">
          {state.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={state.image} alt={state.imageAlt || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--st-text-secondary)] text-xs">Image</div>
          )}
        </div>
        <div className="p-3 flex flex-col justify-center flex-1 min-w-0">
          <div className="text-sm font-bold truncate text-black dark:text-white leading-tight mb-1">{state.title || 'Page Title'}</div>
          <div className="text-xs text-[var(--st-text-secondary)] line-clamp-2 leading-snug mb-1">{state.description || 'Page description will appear here.'}</div>
          <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-auto">
            <span className="w-3 h-3 rounded-full bg-[var(--st-bg-secondary)] flex-shrink-0" aria-hidden="true"></span>
            {domain}
          </div>
        </div>
      </div>
    );
  }

  if (state.card === 'summary_large_image' || state.card === 'player') {
    return (
      <div className="flex flex-col p-0">
        <div className="w-full aspect-[1.91/1] bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] overflow-hidden relative">
          {state.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={state.image} alt={state.imageAlt || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--st-text-secondary)] text-xs">Hero Image</div>
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
          <div className="text-xs text-[var(--st-text-secondary)] line-clamp-2 leading-snug mb-1">{state.description || 'Page description will appear here.'}</div>
          <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1">
            <span className="w-3 h-3 rounded-full bg-[var(--st-bg-secondary)] flex-shrink-0" aria-hidden="true"></span>
            {domain}
          </div>
        </div>
      </div>
    );
  }

  if (state.card === 'app') {
    return (
      <div className="flex flex-col p-0">
        <div className="p-4 border-b border-[var(--st-border)] flex items-center gap-3">
          <div className="w-16 h-16 bg-[var(--st-bg-secondary)] rounded-xl flex-shrink-0 overflow-hidden">
            {state.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={state.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--st-text-secondary)] text-[10px]">App Icon</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold truncate text-black dark:text-white leading-tight mb-1">
              {state.appIphoneName || state.appIpadName || state.appGoogleplayName || 'App Name'}
            </div>
            <div className="text-xs text-[var(--st-text-secondary)] line-clamp-2 leading-snug">
              {state.description || 'App description will appear here.'}
            </div>
          </div>
        </div>
        <div className="p-3 flex justify-between items-center bg-[var(--st-bg-secondary)]">
          <div className="text-xs text-[var(--st-text-secondary)] font-medium">Get the app</div>
          <div className="px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold">
            View
          </div>
        </div>
      </div>
    );
  }

  return null;
}
