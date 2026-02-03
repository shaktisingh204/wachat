'use client';

import { useState } from 'react';
import { SketchPicker } from 'react-color';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Assuming utils exists, typical in shadcn

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    id?: string;
}

export function ColorPicker({ value, onChange, className, id }: ColorPickerProps) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal px-3", className)}
                >
                    <div
                        className="w-4 h-4 rounded-full mr-2 border border-gray-200"
                        style={{ backgroundColor: value }}
                    />
                    {value}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none" align="start">
                <SketchPicker
                    color={value}
                    onChange={(color) => onChange(color.hex)}
                    disableAlpha={true} // Usually hex for simple widgets doesn't need alpha, but can be enabled if needed. Keeping it simple.
                    presetColors={['#25D366', '#128C7E', '#075E54', '#34B7F1', '#ECE5DD', '#FFFFFF', '#000000']}
                />
            </PopoverContent>
        </Popover>
    );
}
