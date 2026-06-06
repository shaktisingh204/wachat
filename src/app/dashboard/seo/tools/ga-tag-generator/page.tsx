'use client';

import { Button, Card, CardBody, Input, Label, Textarea, Switch } from '@/components/sabcrm/20ui';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function GaTagGeneratorPage() {
  // Global Snippet States
  const [id, setId] = useState('G-XXXXXXXXXX');
  const [advanced, setAdvanced] = useState(false);
  const [domains, setDomains] = useState('');
  const [anonymizeIp, setAnonymizeIp] = useState(false);
  const [trackUserId, setTrackUserId] = useState(false);
  const [userIdVar, setUserIdVar] = useState("'YOUR_USER_ID'");
  const [copied, setCopied] = useState(false);

  // Custom Event States
  const [eventName, setEventName] = useState('sign_up');
  const [eventParams, setEventParams] = useState('{\n  method: "google"\n}');
  const [eventCopied, setEventCopied] = useState(false);

  const globalSnippet = useMemo(() => {
    const safeId = (id || '').trim() || 'G-XXXXXXXXXX';
    const hasDomains = advanced && domains.trim().length > 0;
    
    const configItems: string[] = [];

    if (advanced) {
      if (anonymizeIp) {
        configItems.push(`'anonymize_ip': true`);
      }
      if (trackUserId && userIdVar.trim().length > 0) {
        configItems.push(`'user_id': ${userIdVar}`);
      }
      if (hasDomains) {
        const domainList = domains
          .split(',')
          .map(d => d.trim())
          .filter(d => d.length > 0)
          .map(d => `'${d}'`)
          .join(', ');
        
        if (domainList) {
          configItems.push(`'linker': {\n      'domains': [${domainList}]\n    }`);
        }
      }
    }

    let configStr = '';
    if (configItems.length > 0) {
      configStr = `, {\n    ${configItems.join(',\n    ')}\n  }`;
    }

    return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${safeId}'${configStr});
</script>`;
  }, [id, advanced, domains, anonymizeIp, trackUserId, userIdVar]);

  const eventSnippet = useMemo(() => {
    const safeEventName = (eventName || '').trim() || 'event_name';
    let paramsStr = '';
    if (eventParams.trim().length > 0) {
      paramsStr = `, ${eventParams}`;
    }
    return `gtag('event', '${safeEventName}'${paramsStr});`;
  }, [eventName, eventParams]);

  const handleCopyGlobal = async () => {
    try {
      await navigator.clipboard.writeText(globalSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleCopyEvent = async () => {
    try {
      await navigator.clipboard.writeText(eventSnippet);
      setEventCopied(true);
      setTimeout(() => setEventCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <ToolShell
      title="GA4 Tag Generator"
      description="Generate the Google Analytics 4 gtag.js snippet and custom events for your website."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Global Tag Section */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold tracking-tight">Global Site Tag</h2>
          <Card>
            <CardBody className="p-4 space-y-4">
              <div className="space-y-3">
                <Label htmlFor="ga-id">GA4 Measurement ID</Label>
                <Input
                  id="ga-id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="advanced-config">Advanced Configuration</Label>
                  <p className="text-[0.8rem] text-[var(--st-text-secondary)]">
                    Anonymize IP, User ID, Cross-domain
                  </p>
                </div>
                <Switch
                  id="advanced-config"
                  checked={advanced}
                  onCheckedChange={setAdvanced}
                />
              </div>

              {advanced && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200 border-t mt-4">
                  <div className="flex items-center justify-between pt-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="anonymize-ip">Anonymize IP</Label>
                      <p className="text-[0.8rem] text-[var(--st-text-secondary)]">
                        Mask user IP addresses
                      </p>
                    </div>
                    <Switch
                      id="anonymize-ip"
                      checked={anonymizeIp}
                      onCheckedChange={setAnonymizeIp}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="track-user-id">Track User ID</Label>
                      <p className="text-[0.8rem] text-[var(--st-text-secondary)]">
                        Associate sessions with a known user
                      </p>
                    </div>
                    <Switch
                      id="track-user-id"
                      checked={trackUserId}
                      onCheckedChange={setTrackUserId}
                    />
                  </div>

                  {trackUserId && (
                    <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                      <Label htmlFor="user-id-var">User ID Variable / Value</Label>
                      <Input
                        id="user-id-var"
                        value={userIdVar}
                        onChange={(e) => setUserIdVar(e.target.value)}
                        placeholder="e.g. 'USER_123' or currentUser.id"
                      />
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <Label htmlFor="domains">Cross-Domain Tracking</Label>
                    <Input
                      id="domains"
                      value={domains}
                      onChange={(e) => setDomains(e.target.value)}
                      placeholder="e.g. example.com, otherdomain.com"
                    />
                    <p className="text-[0.8rem] text-[var(--st-text-secondary)]">
                      Comma-separated list of domains to track across.
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="global-snippet">Generated Global Snippet</Label>
              <Button size="sm" variant="outline" onClick={handleCopyGlobal}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Textarea id="global-snippet" readOnly value={globalSnippet} className="min-h-[260px] font-mono text-xs" />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Paste this snippet just before the closing &lt;/head&gt; tag on every page you want to track.
            </p>
          </div>
        </div>

        {/* Custom Event Section */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold tracking-tight">Custom Event Snippet</h2>
          <Card>
            <CardBody className="p-4 space-y-4">
              <div className="space-y-3">
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. sign_up, purchase, form_submit"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="event-params">Event Parameters (JSON / JS Object)</Label>
                <Textarea
                  id="event-params"
                  value={eventParams}
                  onChange={(e) => setEventParams(e.target.value)}
                  placeholder={'{\n  value: 10.00,\n  currency: "USD"\n}'}
                  className="font-mono text-xs min-h-[120px]"
                />
              </div>
            </CardBody>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="event-snippet">Generated Event Snippet</Label>
              <Button size="sm" variant="outline" onClick={handleCopyEvent}>
                {eventCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Textarea id="event-snippet" readOnly value={eventSnippet} className="min-h-[120px] font-mono text-xs" />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Trigger this snippet on user actions, such as a button click or form submission.
            </p>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
