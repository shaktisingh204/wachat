'use client';

import {
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Card,
  CardBody,
  RadioGroup,
  Radio,
  Badge,
  EmptyState,
  SegmentedControl,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Video,
  AlertCircle,
  LayoutGrid,
  Upload,
} from 'lucide-react';

// Types
export type CarouselCardData = {
  id: string; // unique ID for DnD
  headerFormat: 'IMAGE' | 'VIDEO' | 'NONE';
  headerSampleUrl: string; // for preview
  headerFile?: File; // for upload
  body: string;
  exampleValues?: Record<string, string>; // Map of variable number to example string
  buttons: CarouselButtonType[];
};

export type CarouselButtonType = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  payload?: string;
  example?: string[];
};

interface CarouselBuilderProps {
  cards: CarouselCardData[];
  onChange: (cards: CarouselCardData[]) => void;
}

// Sortable Item Component (Filmstrip card)
function SortableCard({
  id,
  card,
  index,
  isActive,
  onClick,
  onRemove,
}: {
  id: string;
  card: CarouselCardData;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className={[
          'w-32 h-40 border-2 rounded-[var(--st-radius)] cursor-pointer flex flex-col overflow-hidden bg-[var(--st-bg-secondary)] transition-all',
          isActive
            ? 'border-[var(--st-accent)] shadow-md scale-105'
            : 'border-[var(--st-border)] hover:border-[var(--st-accent)]',
        ].join(' ')}
        onClick={onClick}
      >
        {/* Header Preview */}
        <div className="h-16 bg-[var(--st-bg)] flex items-center justify-center text-[var(--st-text-secondary)] w-full">
          {card.headerFormat === 'IMAGE' &&
            (card.headerSampleUrl ? (
              <img src={card.headerSampleUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
            ))}
          {card.headerFormat === 'VIDEO' && <Video className="h-6 w-6" aria-hidden="true" />}
          {card.headerFormat === 'NONE' && <span className="text-xs">No Header</span>}
        </div>
        {/* Body Preview */}
        <div className="p-2 text-[10px] text-[var(--st-text-secondary)] overflow-hidden flex-1 leading-tight">
          {card.body || 'Empty body...'}
        </div>
        {/* Grip Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        >
          <IconButton
            label="Drag to reorder"
            icon={GripVertical}
            size="sm"
            variant="secondary"
            tabIndex={-1}
          />
        </div>
        {/* Delete Button */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
          <IconButton
            label={`Delete card ${index + 1}`}
            icon={Trash2}
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        </div>
      </div>
      {/* Number Badge */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
        <Badge tone="neutral" kind="soft">
          Card {index + 1}
        </Badge>
      </div>
    </div>
  );
}

export function CarouselBuilder({ cards, onChange }: CarouselBuilderProps) {
  const [activeCardId, setActiveCardId] = useState<string>(cards[0]?.id || '');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = cards.findIndex((c) => c.id === active.id);
      const newIndex = cards.findIndex((c) => c.id === over?.id);
      onChange(arrayMove(cards, oldIndex, newIndex));
    }
  };

  const addCard = () => {
    if (cards.length >= 10) return;
    const currentFormat = cards[0]?.headerFormat || 'IMAGE';
    const newCard: CarouselCardData = {
      id: crypto.randomUUID(),
      headerFormat: currentFormat,
      headerSampleUrl: '',
      body: '',
      buttons: [],
    };
    const newCards = [...cards, newCard];
    onChange(newCards);
    setActiveCardId(newCard.id);
  };

  const removeCard = (id: string) => {
    if (cards.length <= 1) return; // Prevent deleting last card
    const newCards = cards.filter((c) => c.id !== id);
    onChange(newCards);
    if (activeCardId === id) {
      setActiveCardId(newCards[0].id);
    }
  };

  const updateActiveCard = (field: keyof CarouselCardData, value: any) => {
    onChange(cards.map((c) => (c.id === activeCardId ? { ...c, [field]: value } : c)));
  };

  const setAllCardsFormat = (format: CarouselCardData['headerFormat']) => {
    onChange(cards.map((c) => ({ ...c, headerFormat: format })));
  };

  const updateActiveCardButton = (index: number, button: CarouselButtonType) => {
    const card = cards.find((c) => c.id === activeCardId);
    if (!card) return;
    const newButtons = [...card.buttons];
    newButtons[index] = button;
    updateActiveCard('buttons', newButtons);
  };

  const addActiveCardButton = (type: CarouselButtonType['type']) => {
    const card = cards.find((c) => c.id === activeCardId);
    if (!card || card.buttons.length >= 2) return;
    updateActiveCard('buttons', [...card.buttons, { type, text: '' }]);
  };

  const removeActiveCardButton = (index: number) => {
    const card = cards.find((c) => c.id === activeCardId);
    if (!card) return;
    updateActiveCard(
      'buttons',
      card.buttons.filter((_, i) => i !== index),
    );
  };

  const activeCard = cards.find((c) => c.id === activeCardId);
  const activeIndex = cards.findIndex((c) => c.id === activeCardId);

  return (
    <div className="space-y-6">
      {/* 1. Filmstrip / Sorter */}
      <Card variant="outlined" padding="md" className="bg-[var(--st-bg)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[var(--st-text)]">
            Carousel Cards ({cards.length}/10)
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={addCard}
            disabled={cards.length >= 10}
          >
            Add Card
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-8 pt-2 px-2 scrollbar-thin">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cards.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {cards.map((card, index) => (
                <SortableCard
                  key={card.id}
                  id={card.id}
                  card={card}
                  index={index}
                  isActive={card.id === activeCardId}
                  onClick={() => setActiveCardId(card.id)}
                  onRemove={() => removeCard(card.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </Card>

      {/* 2. Active Card Editor */}
      {activeCard ? (
        <Card variant="outlined" padding="lg" className="space-y-6 animate-in fade-in duration-300">
          <CardBody className="space-y-6">
            <div className="flex items-center gap-2">
              <Badge tone="accent" kind="soft">
                Editing Card {activeIndex + 1}
              </Badge>
            </div>

            {/* Header Config */}
            <div className="space-y-4">
              <Field label="Header Media (Applies to all cards)">
                <SegmentedControl
                  aria-label="Header media format"
                  items={[
                    { value: 'IMAGE', label: 'Image', icon: ImageIcon },
                    { value: 'VIDEO', label: 'Video', icon: Video },
                  ]}
                  value={activeCard.headerFormat === 'VIDEO' ? 'VIDEO' : 'IMAGE'}
                  onChange={(v) => setAllCardsFormat(v as CarouselCardData['headerFormat'])}
                />
              </Field>

              {(activeCard.headerFormat === 'IMAGE' || activeCard.headerFormat === 'VIDEO') && (
                <div className="space-y-2 max-w-lg">
                  <Field
                    label={`Sample ${activeCard.headerFormat === 'IMAGE' ? 'Image' : 'Video'}`}
                    help="This file is for approval only. Dynamic media will be sent in broadcasts."
                  >
                    <div className="flex flex-col gap-2">
                      <SabFileToFileButton
                        accept={activeCard.headerFormat === 'IMAGE' ? 'image' : 'video'}
                        onPickFile={(file, pick) => {
                          // Merge updates to avoid stale state closure race condition
                          const updatedCards = cards.map((c) =>
                            c.id === activeCardId
                              ? { ...c, headerFile: file, headerSampleUrl: pick.url }
                              : c,
                          );
                          onChange(updatedCards);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          {activeCard.headerFile ? 'Replace file' : 'Pick from SabFiles'}
                        </span>
                      </SabFileToFileButton>

                      {activeCard.headerFile && (
                        <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-2 bg-[var(--st-bg)] p-2 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                          <span className="font-semibold text-[var(--st-text)]">Selected:</span>
                          <span className="truncate">{activeCard.headerFile.name}</span>
                          <span className="ml-auto">
                            <IconButton
                              label="Remove selected file"
                              icon={Trash2}
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const updated = cards.map((c) =>
                                  c.id === activeCardId
                                    ? { ...c, headerFile: undefined, headerSampleUrl: '' }
                                    : c,
                                );
                                onChange(updated);
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              )}
            </div>

            {/* Body Config */}
            <div className="space-y-2">
              <Field
                label="Body Text"
                help={`${activeCard.body.length} chars`}
              >
                <Textarea
                  placeholder="Enter text here. Use {{1}} for variables..."
                  value={activeCard.body}
                  onChange={(e) => updateActiveCard('body', e.target.value)}
                  className="min-h-[100px]"
                />
              </Field>

              {/* Variable Examples via helper */}
              {(() => {
                const matches = activeCard.body.match(/{{\s*(\d+)\s*}}/g);
                if (matches && matches.length > 0) {
                  const vars = [
                    ...new Set(
                      matches.map((m) => {
                        const num = m.match(/\d+/);
                        return num ? parseInt(num[0]) : 0;
                      }),
                    ),
                  ]
                    .sort((a, b) => a - b)
                    .filter((n) => n > 0);

                  if (vars.length > 0) {
                    return (
                      <Card
                        variant="outlined"
                        padding="md"
                        className="space-y-2 bg-[var(--st-bg)] mt-4"
                      >
                        <span className="text-xs font-semibold flex items-center gap-2 text-[var(--st-text)]">
                          <AlertCircle
                            className="h-3 w-3 text-[var(--st-warn)]"
                            aria-hidden="true"
                          />
                          Variable Values (Required)
                        </span>
                        <div className="grid gap-2">
                          {vars.map((v) => (
                            <div key={v} className="flex items-center gap-2">
                              <span className="text-xs text-[var(--st-text-secondary)] w-8 font-mono">{`{{${v}}}`}</span>
                              <Input
                                inputSize="sm"
                                className="flex-1"
                                placeholder="e.g. John"
                                aria-label={`Example value for variable ${v}`}
                                value={activeCard.exampleValues?.[String(v)] || ''}
                                onChange={(e) => {
                                  const newExamples = {
                                    ...(activeCard.exampleValues || {}),
                                    [String(v)]: e.target.value,
                                  };
                                  updateActiveCard('exampleValues', newExamples);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  }
                }
                return null;
              })()}
            </div>

            {/* Buttons Config */}
            <div className="space-y-3">
              <span className="text-sm font-semibold text-[var(--st-text)]">
                Buttons ({activeCard.buttons.length}/2)
              </span>
              <div className="space-y-3">
                {activeCard.buttons.map((btn, index) => (
                  <Card
                    key={index}
                    variant="outlined"
                    padding="md"
                    className="flex gap-2 items-start bg-[var(--st-bg)]"
                  >
                    <div className="grid gap-2 flex-1">
                      <RadioGroup
                        aria-label="Button type"
                        orientation="horizontal"
                        value={btn.type}
                        onValueChange={(value) =>
                          updateActiveCardButton(index, {
                            ...btn,
                            type: value as CarouselButtonType['type'],
                          })
                        }
                      >
                        <Radio value="QUICK_REPLY" label="Quick Reply" />
                        <Radio value="URL" label="Link" />
                        <Radio value="PHONE_NUMBER" label="Phone" />
                      </RadioGroup>

                      <Input
                        placeholder="Button Label"
                        aria-label="Button label"
                        value={btn.text}
                        onChange={(e) =>
                          updateActiveCardButton(index, { ...btn, text: e.target.value })
                        }
                      />

                      {btn.type === 'URL' && (
                        <Input
                          placeholder="https://website.com"
                          aria-label="Button URL"
                          value={btn.url || ''}
                          onChange={(e) =>
                            updateActiveCardButton(index, { ...btn, url: e.target.value })
                          }
                        />
                      )}

                      {btn.type === 'PHONE_NUMBER' && (
                        <Input
                          placeholder="+1234567890"
                          aria-label="Button phone number"
                          value={btn.phone_number || ''}
                          onChange={(e) =>
                            updateActiveCardButton(index, {
                              ...btn,
                              phone_number: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>
                    <IconButton
                      label={`Remove button ${index + 1}`}
                      icon={Trash2}
                      variant="ghost"
                      onClick={() => removeActiveCardButton(index)}
                    />
                  </Card>
                ))}
              </div>

              {activeCard.buttons.length < 2 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => addActiveCardButton('QUICK_REPLY')}
                  >
                    Add Button
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          icon={LayoutGrid}
          title="Select a card to edit"
          description="Pick a card from the filmstrip above, or add a new one to start building your carousel."
        />
      )}
    </div>
  );
}
