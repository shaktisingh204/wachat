'use client';

/**
 * TemplateInputRenderer (wachat-local, ZoruUI)
 *
 * Renders the dynamic per-template variable inputs (header text vars,
 * media file/URL, location header, body vars, button params, carousel
 * card media). Same form-field names + behavior as the wabasimplify
 * version — only the visual layer is on Zoru primitives.
 */

import * as React from 'react';
import { useState } from 'react';
import {
  Check,
  ChevronsUpDown,
  Link as LinkIcon,
  MapPin,
  UploadCloud,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import type { Template } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruInput,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  cn,
} from '@/components/zoruui';

interface SmartVariableInputProps {
  id: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  variableOptions?: string[];
  value?: string;
  onChange?: (value: string) => void;
}

function SmartVariableInput({
  id,
  name,
  placeholder,
  required,
  variableOptions = [],
  value,
  onChange,
}: SmartVariableInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  const handleSelect = (currentValue: string) => {
    const newValue = `{{${currentValue}}}`;
    setInputValue(newValue);
    if (onChange) onChange(newValue);
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (onChange) onChange(e.target.value);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <ZoruInput
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          value={inputValue}
          onChange={handleChange}
          className="flex-1"
        />
        {variableOptions.length > 0 && (
          <ZoruPopover open={open} onOpenChange={setOpen}>
            <ZoruPopoverTrigger asChild>
              <ZoruButton
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[40px] px-0 flex-shrink-0"
                type="button"
                title="Select Variable"
              >
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                <span className="sr-only">Select Variable</span>
              </ZoruButton>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent className="w-[200px] p-0" align="end">
              <ZoruCommand>
                <ZoruCommandInput placeholder="Search variable..." />
                <ZoruCommandList>
                  <ZoruCommandEmpty>No variable found.</ZoruCommandEmpty>
                  <ZoruCommandGroup heading="Variables">
                    {variableOptions.map((variable) => (
                      <ZoruCommandItem
                        key={variable}
                        value={variable}
                        onSelect={() => handleSelect(variable)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            inputValue === `{{${variable}}}`
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        {variable}
                      </ZoruCommandItem>
                    ))}
                  </ZoruCommandGroup>
                </ZoruCommandList>
              </ZoruCommand>
            </ZoruPopoverContent>
          </ZoruPopover>
        )}
      </div>
      {variableOptions.length > 0 && (
        <p className="text-[10px] text-zoru-ink-muted mt-1">
          Type manually or select a variable.
        </p>
      )}
    </div>
  );
}

interface TemplateInputRendererProps {
  template: WithId<Template>;
  variableOptions?: string[];
}

export function TemplateInputRenderer({
  template,
  variableOptions = [],
}: TemplateInputRendererProps) {
  const [headerMediaSource, setHeaderMediaSource] = useState<'url' | 'file'>(
    'file',
  );

  const components = template.components || [];

  const getVariables = (text: string | undefined): number[] => {
    if (!text) return [];
    const matches = text.match(/{{\s*(\d+)\s*}}/g);
    return matches
      ? [
          ...new Set(
            matches.map((v) =>
              parseInt(v.replace(/{{\s*|\s*}}/g, '')),
            ),
          ),
        ].sort((a, b) => a - b)
      : [];
  };

  return (
    <div className="space-y-6">
      {/* HEADER components */}
      {components.map((component, idx) => {
        if (component.type === 'HEADER') {
          if (
            component.format === 'TEXT' ||
            (!component.format && component.text)
          ) {
            const vars = getVariables(component.text);
            if (vars.length > 0) {
              return (
                <div key={`header-${idx}`} className="space-y-2">
                  <ZoruLabel className="text-zoru-ink">
                    Header Variables
                  </ZoruLabel>
                  {vars.map((v) => (
                    <div key={`header-var-${v}`} className="space-y-1">
                      <ZoruLabel
                        htmlFor={`variable_header_${v}`}
                        className="text-xs text-zoru-ink-muted"
                      >
                        Variable {'{{'}
                        {v}
                        {'}}'}
                      </ZoruLabel>
                      <SmartVariableInput
                        id={`variable_header_${v}`}
                        name={`variable_header_${v}`}
                        placeholder={`Value for {{${v}}}`}
                        required
                        variableOptions={variableOptions}
                      />
                    </div>
                  ))}
                </div>
              );
            }
          } else if (
            ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format || '')
          ) {
            return (
              <div
                key={`header-${idx}`}
                className="space-y-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
              >
                <ZoruLabel className="text-zoru-ink">
                  Header Media ({component.format})
                </ZoruLabel>
                <ZoruRadioGroup
                  value={headerMediaSource}
                  onValueChange={(v) =>
                    setHeaderMediaSource(v as 'url' | 'file')
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <ZoruRadioGroupItem value="file" id="h-source-file" />
                    <ZoruLabel
                      htmlFor="h-source-file"
                      className="font-normal flex items-center gap-1 cursor-pointer"
                    >
                      <UploadCloud className="h-4 w-4" /> Upload
                    </ZoruLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ZoruRadioGroupItem value="url" id="h-source-url" />
                    <ZoruLabel
                      htmlFor="h-source-url"
                      className="font-normal flex items-center gap-1 cursor-pointer"
                    >
                      <LinkIcon className="h-4 w-4" /> URL
                    </ZoruLabel>
                  </div>
                </ZoruRadioGroup>

                {headerMediaSource === 'file' ? (
                  <div className="space-y-1">
                    <input type="hidden" name="mediaSource" value="file" />
                    <ZoruInput
                      name="headerMediaFile"
                      type="file"
                      accept={
                        component.format === 'IMAGE'
                          ? 'image/*'
                          : component.format === 'VIDEO'
                            ? 'video/*'
                            : 'application/pdf'
                      }
                      required
                    />
                    <p className="text-[10px] text-zoru-ink-muted">
                      Supports{' '}
                      {component.format === 'IMAGE'
                        ? 'JPG, PNG'
                        : component.format === 'VIDEO'
                          ? 'MP4'
                          : 'PDF'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input type="hidden" name="mediaSource" value="url" />
                    <ZoruInput
                      name="headerMediaUrl"
                      type="url"
                      placeholder={`https://example.com/${component.format?.toLowerCase()}`}
                      required
                    />
                  </div>
                )}
              </div>
            );
          } else if (component.format === 'LOCATION') {
            return (
              <div
                key={`header-${idx}`}
                className="space-y-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
              >
                <ZoruLabel className="flex items-center gap-2 text-zoru-ink">
                  <MapPin className="h-4 w-4" /> Location Header
                </ZoruLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <ZoruLabel htmlFor="location_lat" className="text-xs">
                      Latitude
                    </ZoruLabel>
                    <ZoruInput
                      name="location_lat"
                      id="location_lat"
                      placeholder="25.2048"
                      required
                      step="any"
                      type="number"
                    />
                  </div>
                  <div className="space-y-1">
                    <ZoruLabel htmlFor="location_long" className="text-xs">
                      Longitude
                    </ZoruLabel>
                    <ZoruInput
                      name="location_long"
                      id="location_long"
                      placeholder="55.2708"
                      required
                      step="any"
                      type="number"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <ZoruLabel htmlFor="location_name" className="text-xs">
                      Location Name
                    </ZoruLabel>
                    <ZoruInput
                      name="location_name"
                      id="location_name"
                      placeholder="Burj Khalifa"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <ZoruLabel htmlFor="location_address" className="text-xs">
                      Address
                    </ZoruLabel>
                    <ZoruInput
                      name="location_address"
                      id="location_address"
                      placeholder="1 Sheikh Mohammed bin Rashid Blvd - Dubai"
                      required
                    />
                  </div>
                </div>
              </div>
            );
          }
        }
        return null;
      })}

      {/* BODY variables */}
      {(() => {
        const bodyComp = components.find((c) => c.type === 'BODY');
        const bodyText = bodyComp?.text || (template as any).body;
        const vars = getVariables(bodyText);

        if (vars.length === 0) return null;

        return (
          <div className="space-y-3">
            <ZoruLabel className="text-zoru-ink">Body Variables</ZoruLabel>
            <div className="grid gap-3">
              {vars.map((v) => (
                <div key={`body-var-${v}`} className="space-y-1">
                  <ZoruLabel
                    htmlFor={`variable_body_${v}`}
                    className="text-xs text-zoru-ink-muted"
                  >
                    Variable {'{{'}
                    {v}
                    {'}}'}
                  </ZoruLabel>
                  <SmartVariableInput
                    id={`variable_body_${v}`}
                    name={`variable_body_${v}`}
                    placeholder={`Val for {{${v}}}`}
                    required
                    variableOptions={variableOptions}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* BUTTONS — interactive params (COPY_CODE / dynamic URL) */}
      {(() => {
        const buttonsComp = components.find((c) => c.type === 'BUTTONS');
        if (!buttonsComp || !buttonsComp.buttons) return null;

        const interactiveButtons = buttonsComp.buttons
          .map((btn: any, idx: number) => ({ ...btn, index: idx }))
          .filter(
            (btn: any) =>
              btn.type === 'COPY_CODE' ||
              (btn.type === 'URL' && btn.url?.includes('{{1}}')),
          );

        if (interactiveButtons.length === 0) return null;

        return (
          <div className="space-y-3 pt-2">
            <ZoruLabel className="text-zoru-ink">Button Parameters</ZoruLabel>
            <div className="grid gap-3">
              {interactiveButtons.map((btn: any) => (
                <div key={`btn-${btn.index}`} className="space-y-1">
                  <ZoruLabel
                    htmlFor={`variable_button_${btn.index}`}
                    className="text-xs text-zoru-ink-muted"
                  >
                    {btn.type === 'COPY_CODE'
                      ? `Coupon Code (Button: ${btn.text})`
                      : `URL Suffix (Button: ${btn.text})`}
                  </ZoruLabel>
                  <SmartVariableInput
                    id={`variable_button_${btn.index}`}
                    name={`variable_button_${btn.index}`}
                    placeholder={
                      btn.type === 'COPY_CODE' ? 'SUMMER20' : 'promo/123'
                    }
                    required
                    variableOptions={variableOptions}
                  />
                  {btn.type === 'URL' && (
                    <p className="text-[10px] text-zoru-ink-muted">
                      Appended to: {btn.url.split('{{1}}')[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CAROUSEL card media */}
      {(template as any).type === 'MARKETING_CAROUSEL' && (
        <div className="space-y-4 border-t border-zoru-line pt-4">
          <h3 className="text-sm text-zoru-ink">Carousel Cards Media</h3>
          <p className="text-xs text-zoru-ink-muted">
            Upload media for each card.
          </p>

          <div className="grid gap-4">
            {template.components
              ?.find((c) => c.type === 'CAROUSEL')
              ?.cards?.map((card: any, index: number) => {
                const header = card.components?.find(
                  (c: any) => c.type === 'HEADER',
                );
                if (!header || !['IMAGE', 'VIDEO'].includes(header.format))
                  return null;

                return (
                  <div
                    key={index}
                    className="space-y-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
                  >
                    <div className="flex justify-between items-center">
                      <ZoruLabel className="text-zoru-ink">
                        Card {index + 1} ({header.format})
                      </ZoruLabel>
                    </div>
                    <ZoruInput
                      name={`card_${index}_media_file`}
                      type="file"
                      accept={
                        header.format === 'IMAGE' ? 'image/*' : 'video/*'
                      }
                      required
                    />
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
