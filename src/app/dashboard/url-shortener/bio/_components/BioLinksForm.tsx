import { useState } from 'react';
import { Card, Input, Label, Button, Switch } from '@/components/sabcrm/20ui';
import { GripVertical, Trash2, Plus, QrCode, BarChart2, Settings2 } from 'lucide-react';
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
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[13px] text-[var(--st-text)]">
            Links <span className="text-[var(--st-text-secondary)]">({state.links.length}/20)</span>
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addLink}
            disabled={state.links.length >= 20}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Link
          </Button>
        </div>

        {state.links.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
            No links yet. Click "Add Link" to get started.
          </p>
        ) : (
          <ul className="space-y-4">
            {state.links.map((link) => (
              <li key={link.id} className="border border-[var(--st-border)] rounded-lg p-3 bg-[var(--st-text)]/30">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="mt-2.5 cursor-grab text-[var(--st-text-secondary)]/40 hover:text-[var(--st-text-secondary)]"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Label"
                        value={link.label}
                        onChange={(e) => updateLink(link.id, { label: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        placeholder="https://"
                        value={link.url}
                        onChange={(e) => updateLink(link.id, { url: e.target.value })}
                        className="flex-[2]"
                      />
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="mt-3 ml-6 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[var(--st-text-secondary)] hover:text-white"
                      onClick={() => toggleSettings(link.id)}
                    >
                      <Settings2 className="h-3.5 w-3.5 mr-1" />
                      A/B Testing
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[var(--st-text-secondary)] hover:text-white"
                      onClick={() => setActiveAnalyticsLink(link)}
                    >
                      <BarChart2 className="h-3.5 w-3.5 mr-1" />
                      Analytics ({link.clicks ?? 0})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[var(--st-text-secondary)] hover:text-white"
                      onClick={() => setActiveQRLink(link)}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1" />
                      QR Code
                    </Button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeLink(link.id)}
                    className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)]"
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Expanded Settings */}
                {expandedSettings[link.id] && (
                  <div className="mt-3 ml-6 p-3 rounded-md bg-[var(--st-text)] border border-[var(--st-border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-[var(--st-text-secondary)]">Enable A/B Testing</Label>
                      <Switch
                        checked={link.enableABTesting || false}
                        onCheckedChange={(checked) => updateLink(link.id, { enableABTesting: checked })}
                      />
                    </div>
                    {link.enableABTesting && (
                      <div className="space-y-2 pt-2 border-t border-[var(--st-border)]">
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-[var(--st-text-secondary)]">Variant B URL</Label>
                          <Input
                            placeholder="https:// variant B..."
                            value={link.urlB || ''}
                            onChange={(e) => updateLink(link.id, { urlB: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <Label className="text-xs text-[var(--st-text-secondary)] whitespace-nowrap">Traffic Split (A/B)</Label>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={link.splitRatio ?? 50}
                              onChange={(e) => updateLink(link.id, { splitRatio: parseInt(e.target.value, 10) })}
                              className="flex-1 w-full"
                            />
                            <span className="text-xs font-mono text-[var(--st-text)] w-10 text-right">
                              {link.splitRatio ?? 50}%
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--st-text)]">
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
