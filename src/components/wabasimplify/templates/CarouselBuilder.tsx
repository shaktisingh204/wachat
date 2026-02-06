'use client';

import { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';

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

// Sortable Item Component (Filmstrip Card)
function SortableCard({ id, card, isActive, onClick, onRemove }: { id: string, card: CarouselCardData, isActive: boolean, onClick: () => void, onRemove: (e: any) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            <div
                className={`
                    w-32 h-40 border-2 rounded-lg cursor-pointer flex flex-col overflow-hidden bg-card transition-all
                    ${isActive ? 'border-primary shadow-md scale-105' : 'border-muted hover:border-primary/50'}
                `}
                onClick={onClick}
            >
                {/* Header Preview */}
                <div className="h-16 bg-muted flex items-center justify-center text-muted-foreground w-full">
                    {card.headerFormat === 'IMAGE' && (card.headerSampleUrl ? <img src={card.headerSampleUrl} className="w-full h-full object-cover" /> : <ImageIcon className="h-6 w-6" />)}
                    {card.headerFormat === 'VIDEO' && <Video className="h-6 w-6" />}
                    {card.headerFormat === 'NONE' && <span className="text-xs">No Header</span>}
                </div>
                {/* Body Preview */}
                <div className="p-2 text-[10px] text-muted-foreground overflow-hidden flex-1 leading-tight">
                    {card.body || 'Empty body...'}
                </div>
                {/* Grip Handle */}
                <div {...attributes} {...listeners} className="absolute top-1 left-1 p-1 bg-background/80 rounded opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing hover:bg-accent ring-1 ring-border">
                    <GripVertical className="h-3 w-3" />
                </div>
                {/* Delete Button */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(e); }}
                    className="absolute top-1 right-1 p-1 bg-destructive/90 text-destructive-foreground rounded opacity-0 group-hover:opacity-100 hover:bg-destructive"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            </div>
            {/* Number Badge */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-mono">
                Card
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
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = cards.findIndex(c => c.id === active.id);
            const newIndex = cards.findIndex(c => c.id === over?.id);
            onChange(arrayMove(cards, oldIndex, newIndex));
        }
    };

    const addCard = () => {
        if (cards.length >= 10) return;
        const newCard: CarouselCardData = {
            id: crypto.randomUUID(),
            headerFormat: 'IMAGE', // Default to image as it's most common
            headerSampleUrl: '',
            body: '',
            buttons: []
        };
        const newCards = [...cards, newCard];
        onChange(newCards);
        setActiveCardId(newCard.id);
    };

    const removeCard = (id: string) => {
        if (cards.length <= 1) return; // Prevent deleting last card
        const newCards = cards.filter(c => c.id !== id);
        onChange(newCards);
        if (activeCardId === id) {
            setActiveCardId(newCards[0].id);
        }
    };

    const updateActiveCard = (field: keyof CarouselCardData, value: any) => {
        onChange(cards.map(c => c.id === activeCardId ? { ...c, [field]: value } : c));
    };

    const updateActiveCardButton = (index: number, button: CarouselButtonType) => {
        const card = cards.find(c => c.id === activeCardId);
        if (!card) return;
        const newButtons = [...card.buttons];
        newButtons[index] = button;
        updateActiveCard('buttons', newButtons);
    };

    const addActiveCardButton = (type: CarouselButtonType['type']) => {
        const card = cards.find(c => c.id === activeCardId);
        if (!card || card.buttons.length >= 2) return;
        updateActiveCard('buttons', [...card.buttons, { type, text: '' }]);
    };

    const removeActiveCardButton = (index: number) => {
        const card = cards.find(c => c.id === activeCardId);
        if (!card) return;
        updateActiveCard('buttons', card.buttons.filter((_, i) => i !== index));
    };

    const activeCard = cards.find(c => c.id === activeCardId);

    return (
        <div className="space-y-6">

            {/* 1. Filmstrip / Sorter */}
            <div className="bg-muted/30 p-4 rounded-xl border">
                <div className="flex items-center justify-between mb-4">
                    <Label className="text-sm font-semibold">Carousel Cards ({cards.length}/10)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addCard} disabled={cards.length >= 10}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Card
                    </Button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-thin">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={cards.map(c => c.id)}
                            strategy={horizontalListSortingStrategy}
                        >
                            {cards.map((card) => (
                                <SortableCard
                                    key={card.id}
                                    id={card.id}
                                    card={card}
                                    isActive={card.id === activeCardId}
                                    onClick={() => setActiveCardId(card.id)}
                                    onRemove={() => removeCard(card.id)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            {/* 2. Active Card Editor */}
            {activeCard ? (
                <div className="grid md:grid-cols-12 gap-6 animate-in fade-in duration-300">

                    {/* Editor Column */}
                    <div className="md:col-span-12 space-y-6 border rounded-xl p-6 bg-card relative">
                        <div className="absolute -top-3 left-4 bg-background px-2 text-sm font-semibold text-primary">
                            Editing Card {cards.findIndex(c => c.id === activeCardId) + 1}
                        </div>

                        {/* Header Config */}
                        <div className="space-y-4">
                            <Label>Header Media</Label>
                            <div className="flex gap-4">
                                <div className={`
                                    flex cursor-pointer items-center justify-center p-4 border rounded-lg hover:bg-accent w-24 h-24 flex-col gap-2 transition-all
                                    ${activeCard.headerFormat === 'IMAGE' ? 'border-primary bg-primary/5' : 'border-muted'}
                                `} onClick={() => updateActiveCard('headerFormat', 'IMAGE')}>
                                    <ImageIcon className="h-6 w-6" />
                                    <span className="text-xs">Image</span>
                                </div>
                                <div className={`
                                    flex cursor-pointer items-center justify-center p-4 border rounded-lg hover:bg-accent w-24 h-24 flex-col gap-2 transition-all
                                    ${activeCard.headerFormat === 'VIDEO' ? 'border-primary bg-primary/5' : 'border-muted'}
                                `} onClick={() => updateActiveCard('headerFormat', 'VIDEO')}>
                                    <Video className="h-6 w-6" />
                                    <span className="text-xs">Video</span>
                                </div>
                            </div>

                            {(activeCard.headerFormat === 'IMAGE' || activeCard.headerFormat === 'VIDEO') && (
                                <div className="space-y-2 max-w-lg">
                                    <Label>Upload Sample {activeCard.headerFormat === 'IMAGE' ? 'Image' : 'Video'}</Label>
                                    <div className="flex flex-col gap-2">
                                        <Input
                                            key={`${activeCard.id}-${activeCard.headerFormat}`} // Force re-mount on card switch to clear browser's internal file state
                                            type="file"
                                            accept={activeCard.headerFormat === 'IMAGE' ? "image/jpeg,image/png" : "video/mp4"}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    updateActiveCard('headerFile', file);
                                                    const url = URL.createObjectURL(file);
                                                    updateActiveCard('headerSampleUrl', url);
                                                }
                                            }}
                                        />
                                        {activeCard.headerFile && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 bg-muted/50 p-2 rounded">
                                                <span className="font-semibold text-primary">Selected:</span>
                                                <span className="truncate">{activeCard.headerFile.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 ml-auto"
                                                    onClick={() => {
                                                        updateActiveCard('headerFile', undefined);
                                                        updateActiveCard('headerSampleUrl', '');
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">This file is for approval only. Dynamic media will be sent in broadcasts.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Body Config */}
                        <div className="space-y-2">
                            <Label>Body Text</Label>
                            <Textarea
                                placeholder="Enter text here. Use {{1}} for variables..."
                                value={activeCard.body}
                                onChange={(e) => updateActiveCard('body', e.target.value)}
                                className="min-h-[100px]"
                            />
                            <p className="text-xs text-muted-foreground text-right">{activeCard.body.length} chars</p>


                            {/* Variable Examples via helper */}
                            {(() => {
                                const matches = activeCard.body.match(/{{\s*(\d+)\s*}}/g);
                                if (matches && matches.length > 0) {
                                    const vars = [...new Set(matches.map(m => {
                                        const num = m.match(/\d+/);
                                        return num ? parseInt(num[0]) : 0;
                                    }))].sort((a, b) => a - b).filter(n => n > 0);

                                    if (vars.length > 0) {
                                        return (
                                            <div className="space-y-2 p-3 bg-muted/30 rounded border mt-4">
                                                <Label className="text-xs font-semibold flex items-center gap-2">
                                                    <AlertCircle className="h-3 w-3 text-amber-500" />
                                                    Variable Values (Required)
                                                </Label>
                                                <div className="grid gap-2">
                                                    {vars.map(v => (
                                                        <div key={v} className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground w-8 font-mono">{`{{${v}}}`}</span>
                                                            <Input
                                                                placeholder={`e.g. John`}
                                                                className="h-8 text-sm"
                                                                value={activeCard.exampleValues?.[String(v)] || ''}
                                                                onChange={(e) => {
                                                                    const newExamples = { ...(activeCard.exampleValues || {}), [String(v)]: e.target.value };
                                                                    updateActiveCard('exampleValues', newExamples);
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                }
                                return null;
                            })()}
                        </div>

                        {/* Buttons Config */}
                        <div className="space-y-3">
                            <Label>Buttons ({activeCard.buttons.length}/2)</Label>
                            <div className="space-y-3">
                                {activeCard.buttons.map((btn, index) => (
                                    <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-muted/20">
                                        <div className="grid gap-2 flex-1">
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="radio"
                                                        checked={btn.type === 'QUICK_REPLY'}
                                                        onChange={() => updateActiveCardButton(index, { ...btn, type: 'QUICK_REPLY' })}
                                                        className="cursor-pointer"
                                                    />
                                                    <span className="text-sm">Quick Reply</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="radio"
                                                        checked={btn.type === 'URL'}
                                                        onChange={() => updateActiveCardButton(index, { ...btn, type: 'URL' })}
                                                        className="cursor-pointer"
                                                    />
                                                    <span className="text-sm">Link</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="radio"
                                                        checked={btn.type === 'PHONE_NUMBER'}
                                                        onChange={() => updateActiveCardButton(index, { ...btn, type: 'PHONE_NUMBER' })}
                                                        className="cursor-pointer"
                                                    />
                                                    <span className="text-sm">Phone</span>
                                                </div>
                                            </div>

                                            <Input
                                                placeholder="Button Label"
                                                value={btn.text}
                                                onChange={(e) => updateActiveCardButton(index, { ...btn, text: e.target.value })}
                                            />

                                            {btn.type === 'URL' && (
                                                <Input
                                                    placeholder="https://website.com"
                                                    value={btn.url || ''}
                                                    onChange={(e) => updateActiveCardButton(index, { ...btn, url: e.target.value })}
                                                />
                                            )}

                                            {btn.type === 'PHONE_NUMBER' && (
                                                <Input
                                                    placeholder="+1234567890"
                                                    value={btn.phone_number || ''}
                                                    onChange={(e) => updateActiveCardButton(index, { ...btn, phone_number: e.target.value })}
                                                />
                                            )}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeActiveCardButton(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {activeCard.buttons.length < 2 && (
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => addActiveCardButton('QUICK_REPLY')}>+ Add Button</Button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            ) : (
                <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                    Select a card to edit
                </div>
            )}
        </div>
    );
}
