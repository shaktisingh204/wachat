"use client";

import * as React from "react";
import { Columns } from "lucide-react";

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from "@/components/zoruui";

export interface SabsmsColumnDef {
  id: string;
  label: string;
  required?: boolean;
}

export interface SabsmsColumnPickerProps {
  columns: SabsmsColumnDef[];
  visible: string[];
  onChange: (next: string[]) => void;
}

export function SabsmsColumnPicker({
  columns,
  visible,
  onChange,
}: SabsmsColumnPickerProps) {
  return (
    <DropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns className="mr-1.5 h-3.5 w-3.5" />
          Columns
        </Button>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align="end" className="w-56">
        <ZoruDropdownMenuLabel>Visible columns</ZoruDropdownMenuLabel>
        <ZoruDropdownMenuSeparator />
        {columns.map((col) => {
          const checked = visible.includes(col.id);
          return (
            <ZoruDropdownMenuCheckboxItem
              key={col.id}
              checked={checked}
              disabled={col.required}
              onCheckedChange={() => {
                if (col.required) return;
                if (checked) {
                  onChange(visible.filter((v) => v !== col.id));
                } else {
                  onChange([...visible, col.id]);
                }
              }}
            >
              {col.label}
            </ZoruDropdownMenuCheckboxItem>
          );
        })}
      </ZoruDropdownMenuContent>
    </DropdownMenu>
  );
}
