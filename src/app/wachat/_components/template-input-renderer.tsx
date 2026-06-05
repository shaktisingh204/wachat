'use client';

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Field,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  Radio,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Separator,
} from '@/components/sabcrm/20ui';
import {
  useState } from 'react';
import {
  Check,
  ChevronsUpDown,
  Link as LinkIcon,
  MapPin,
  UploadCloud,
  } from 'lucide-react';
import type { WithId } from 'mongodb';

import type { Template } from '@/lib/definitions';

/**
 * TemplateInputRenderer (wachat-local, 20ui)
 *
 * Renders the dynamic per-template variable inputs (header text vars,
 * media file/URL, location header, body vars, button params, carousel
 * card media). Same form-field names + behavior as the wabasimplify
 * version — only the visual layer is on 20ui primitives.
 */

import * as React from 'react';

import { SabFileToFileButton, SabFileUrlInput } from '@/components/sabfiles';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
        <Input
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          value={inputValue}
          onChange={handleChange}
          className="flex-1"
        />
        {variableOptions.length > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-label="Select Variable"
                className="w-[40px] px-0 flex-shrink-0"
                type="button"
                title="Select Variable"
              >
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search variable..." />
                <CommandList>
                  <CommandEmpty>No variable found.</CommandEmpty>
                  <CommandGroup heading="Variables">
                    {variableOptions.map((variable) => (
                      <CommandItem
                        key={variable}
                        value={variable}
                        onSelect={() => handleSelect(variable)}
                      >
                        <Check
                          className={cx(
                            'mr-2 h-4 w-4',
                            inputValue === `{{${variable}}}`
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        {variable}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {variableOptions.length > 0 && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--st-text-muted)' }}>
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
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const headerMediaFileRef = React.useRef<HTMLInputElement>(null);
  const cardMediaRefs = React.useRef<Record<number, HTMLInputElement | null>>(
    {},
  );
  const [pickedHeaderMediaName, setPickedHeaderMediaName] = useState<
    string | null
  >(null);
  const [pickedCardMediaNames, setPickedCardMediaNames] = useState<
    Record<number, string>
  >({});

  const setFileOnInput = (input: HTMLInputElement | null, file: File) => {
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  };

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
                  <p className="text-sm font-medium" style={{ color: 'var(--st-text)' }}>
                    Header Variables
                  </p>
                  {vars.map((v) => (
                    <Field
                      key={`header-var-${v}`}
                      label={`Variable {{${v}}}`}
                      id={`variable_header_${v}`}
                    >
                      <SmartVariableInput
                        id={`variable_header_${v}`}
                        name={`variable_header_${v}`}
                        placeholder={`Value for {{${v}}}`}
                        required
                        variableOptions={variableOptions}
                      />
                    </Field>
                  ))}
                </div>
              );
            }
          } else if (
            ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format || '')
          ) {
            return (
              <Card key={`header-${idx}`} variant="outlined" padding="sm">
                <CardHeader>
                  <CardTitle>Header Media ({component.format})</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <RadioGroup
                      value={headerMediaSource}
                      onValueChange={(v) =>
                        setHeaderMediaSource(v as 'url' | 'file')
                      }
                      orientation="horizontal"
                      aria-label="Header media source"
                      className="flex gap-4"
                    >
                      <Radio
                        value="file"
                        id="h-source-file"
                        label={
                          <span className="flex items-center gap-1">
                            <UploadCloud className="h-4 w-4" /> Upload
                          </span>
                        }
                      />
                      <Radio
                        value="url"
                        id="h-source-url"
                        label={
                          <span className="flex items-center gap-1">
                            <LinkIcon className="h-4 w-4" /> URL
                          </span>
                        }
                      />
                    </RadioGroup>

                    {headerMediaSource === 'file' ? (
                      <div className="space-y-1">
                        <input type="hidden" name="mediaSource" value="file" />
                        <Input
                          ref={headerMediaFileRef}
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
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <p className="text-[10px]" style={{ color: 'var(--st-text-muted)' }}>
                            Supports{' '}
                            {component.format === 'IMAGE'
                              ? 'JPG, PNG'
                              : component.format === 'VIDEO'
                                ? 'MP4'
                                : 'PDF'}
                            {pickedHeaderMediaName
                              ? ` · Picked: ${pickedHeaderMediaName}`
                              : ''}
                          </p>
                          <SabFileToFileButton
                            accept={
                              component.format === 'IMAGE'
                                ? 'image'
                                : component.format === 'VIDEO'
                                  ? 'video'
                                  : 'document'
                            }
                            onPickFile={(file) => {
                              setFileOnInput(headerMediaFileRef.current, file);
                              setPickedHeaderMediaName(file.name);
                            }}
                          >
                            Pick from SabFiles
                          </SabFileToFileButton>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <input type="hidden" name="mediaSource" value="url" />
                        <SabFileUrlInput
                          name="headerMediaUrl"
                          value={headerMediaUrl}
                          onChange={(v) => setHeaderMediaUrl(v)}
                          accept={
                            component.format === 'IMAGE'
                              ? 'image'
                              : component.format === 'VIDEO'
                                ? 'video'
                                : component.format === 'DOCUMENT'
                                  ? 'document'
                                  : 'all'
                          }
                          placeholder={`https://example.com/${component.format?.toLowerCase()}`}
                        />
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          } else if (component.format === 'LOCATION') {
            return (
              <Card key={`header-${idx}`} variant="outlined" padding="sm">
                <CardHeader>
                  <CardTitle>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Location Header
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude" id="location_lat">
                      <Input
                        name="location_lat"
                        id="location_lat"
                        placeholder="25.2048"
                        required
                        step="any"
                        type="number"
                      />
                    </Field>
                    <Field label="Longitude" id="location_long">
                      <Input
                        name="location_long"
                        id="location_long"
                        placeholder="55.2708"
                        required
                        step="any"
                        type="number"
                      />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Location Name" id="location_name">
                        <Input
                          name="location_name"
                          id="location_name"
                          placeholder="Burj Khalifa"
                          required
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Address" id="location_address">
                        <Input
                          name="location_address"
                          id="location_address"
                          placeholder="1 Sheikh Mohammed bin Rashid Blvd - Dubai"
                          required
                        />
                      </Field>
                    </div>
                  </div>
                </CardBody>
              </Card>
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
            <p className="text-sm font-medium" style={{ color: 'var(--st-text)' }}>
              Body Variables
            </p>
            <div className="grid gap-3">
              {vars.map((v) => (
                <Field
                  key={`body-var-${v}`}
                  label={`Variable {{${v}}}`}
                  id={`variable_body_${v}`}
                >
                  <SmartVariableInput
                    id={`variable_body_${v}`}
                    name={`variable_body_${v}`}
                    placeholder={`Val for {{${v}}}`}
                    required
                    variableOptions={variableOptions}
                  />
                </Field>
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
            <p className="text-sm font-medium" style={{ color: 'var(--st-text)' }}>
              Button Parameters
            </p>
            <div className="grid gap-3">
              {interactiveButtons.map((btn: any) => (
                <Field
                  key={`btn-${btn.index}`}
                  label={
                    btn.type === 'COPY_CODE'
                      ? `Coupon Code (Button: ${btn.text})`
                      : `URL Suffix (Button: ${btn.text})`
                  }
                  id={`variable_button_${btn.index}`}
                  help={
                    btn.type === 'URL'
                      ? `Appended to: ${btn.url.split('{{1}}')[0]}`
                      : undefined
                  }
                >
                  <SmartVariableInput
                    id={`variable_button_${btn.index}`}
                    name={`variable_button_${btn.index}`}
                    placeholder={
                      btn.type === 'COPY_CODE' ? 'SUMMER20' : 'promo/123'
                    }
                    required
                    variableOptions={variableOptions}
                  />
                </Field>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CAROUSEL card media */}
      {(template as any).type === 'MARKETING_CAROUSEL' && (
        <div className="space-y-4 pt-4">
          <Separator />
          <p className="text-sm font-medium" style={{ color: 'var(--st-text)' }}>
            Carousel Cards Media
          </p>
          <p className="text-xs" style={{ color: 'var(--st-text-muted)' }}>
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
                  <Card key={index} variant="outlined" padding="md">
                    <CardHeader>
                      <CardTitle>
                        Card {index + 1} ({header.format})
                      </CardTitle>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Input
                          ref={(el) => {
                            cardMediaRefs.current[index] = el;
                          }}
                          name={`card_${index}_media_file`}
                          type="file"
                          accept={
                            header.format === 'IMAGE' ? 'image/*' : 'video/*'
                          }
                          required
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px]" style={{ color: 'var(--st-text-muted)' }}>
                            {pickedCardMediaNames[index]
                              ? `Picked: ${pickedCardMediaNames[index]}`
                              : 'Or pick from SabFiles'}
                          </p>
                          <SabFileToFileButton
                            accept={header.format === 'IMAGE' ? 'image' : 'video'}
                            onPickFile={(file) => {
                              setFileOnInput(
                                cardMediaRefs.current[index] ?? null,
                                file,
                              );
                              setPickedCardMediaNames((prev) => ({
                                ...prev,
                                [index]: file.name,
                              }));
                            }}
                          >
                            Pick from SabFiles
                          </SabFileToFileButton>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
