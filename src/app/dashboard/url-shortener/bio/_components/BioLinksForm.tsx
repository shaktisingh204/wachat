'use client';

import { useState } from 'react';
import {
  Card,
  Input,
  Field,
  Label,
  Button,
  IconButton,
  Switch,
  Slider,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  GripVertical,
  Trash2,
  Plus,
  QrCode,
  BarChart2,
  Settings2,
  Link2,
} from 'lucide-react';
import { BioState, BioLink } from '../types';
import { BioAnalytics } from './BioAnalytics';
import { BioQRCode } from './BioQRCode';

type Props = {
  state: BioState;
  update: (patch: Partial<BioState>) => void;
};

export function BioLinksForm({ state, update }: Props) {
  const [activeAnalyticsLink, setActiveAnalyticsLink] = useState<BioLink | null>(null);
  const [activeQRLink, setActiveQRLink] = useState<BioLink | null>(null);
  const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});

  const addLink = () => {
    if (state.links.length >= 20) return;
    update({
      links: [
        ...state.links,
        { id: crypto.randomUUID(), label: '', url: '', enableABTesting: false, splitRatio: 50, urlB: '' },
      ],
    });
  };

  const updateLink = (id: string, patch: Partial<BioLink>) => {
    update({ links: state.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  };

  const removeLink = (id: string) => {
    update({ links: state.links.filter((l) => l.id !== id) });
  };

  const toggleSettings = (id: string) => {
    setExpandedSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Links <Badge tone="neutral">{state.links.length}/20</Badge>
          </Label>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={addLink}
            disabled={state.links.length >= 20}
          >
            Add Link
          </Button>
        </div>

        {state.links.length === 0 ? (
          <EmptyState
            icon={Link2}
            size="sm"
            title="No links yet"
            description='Click "Add Link" to get started.'
            action={
              <Button size="sm" variant="outline" iconLeft={Plus} onClick={addLink}>
                Add Link
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {state.links.map((link) => (
              <li
                key={link.id}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
              >
                <div className="flex items-start gap-2">
                  <IconButton
                    icon={GripVertical}
                    label="Drag to reorder"
                    size="sm"
                    variant="ghost"
                    className="mt-1 cursor-grab"
                  />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex gap-2">
                      <Field className="flex-1" label="Label" id={`bio-label-${link.id}`}>
                        <Input
                          placeholder="My website"
                          value={link.label}
                          onChange={(e) => updateLink(link.id, { label: e.target.value })}
                        />
                      </Field>
                      <Field className="flex-[2]" label="Destination URL" id={`bio-url-${link.id}`}>
                        <Input
                          placeholder="https://example.com"
                          value={link.url}
                          onChange={(e) => updateLink(link.id, { url: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="ml-6 mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Settings2}
                      onClick={() => toggleSettings(link.id)}
                    >
                      A/B Testing
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={BarChart2}
                      onClick={() => setActiveAnalyticsLink(link)}
                    >
                      Analytics ({link.clicks ?? 0})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={QrCode}
                      onClick={() => setActiveQRLink(link)}
                    >
                      QR Code
                    </Button>
                  </div>

                  <IconButton
                    icon={Trash2}
                    label="Remove link"
                    size="sm"
                    variant="danger"
                    onClick={() => removeLink(link.id)}
                  />
                </div>

                {/* Expanded Settings */}
                {expandedSettings[link.id] && (
                  <div className="ml-6 mt-3 space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`bio-ab-${link.id}`}>Enable A/B Testing</Label>
                      <Switch
                        id={`bio-ab-${link.id}`}
                        aria-label="Enable A/B testing for this link"
                        checked={link.enableABTesting || false}
                        onCheckedChange={(checked) => updateLink(link.id, { enableABTesting: checked })}
                      />
                    </div>
                    {link.enableABTesting && (
                      <div className="space-y-3 border-t border-[var(--st-border)] pt-3">
                        <Field label="Variant B URL" id={`bio-urlb-${link.id}`}>
                          <Input
                            inputSize="sm"
                            placeholder="https://example.com/variant-b"
                            value={link.urlB || ''}
                            onChange={(e) => updateLink(link.id, { urlB: e.target.value })}
                          />
                        </Field>
                        <div className="flex items-center justify-between gap-4">
                          <Label className="whitespace-nowrap" htmlFor={`bio-split-${link.id}`}>
                            Traffic Split (A/B)
                          </Label>
                          <div className="flex flex-1 items-center gap-2">
                            <Slider
                              id={`bio-split-${link.id}`}
                              ariaLabel="Traffic split percentage to variant A"
                              className="flex-1"
                              min={0}
                              max={100}
                              step={1}
                              value={link.splitRatio ?? 50}
                              onValueChange={(v) =>
                                updateLink(link.id, {
                                  splitRatio: Array.isArray(v) ? v[0] : v,
                                })
                              }
                            />
                            <span className="w-10 text-right font-mono text-xs text-[var(--st-text)]">
                              {link.splitRatio ?? 50}%
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-[var(--st-text-secondary)]">
                          {link.splitRatio ?? 50}% of traffic goes to Variant A, {100 - (link.splitRatio ?? 50)}% to Variant B.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BioAnalytics link={activeAnalyticsLink} onClose={() => setActiveAnalyticsLink(null)} />
      <BioQRCode link={activeQRLink} onClose={() => setActiveQRLink(null)} />
    </>
  );
}
