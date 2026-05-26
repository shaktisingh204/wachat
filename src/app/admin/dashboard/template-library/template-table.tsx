'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Button,
  Checkbox,
  Input,
} from '@/components/zoruui';
import { ChevronLeft, ChevronRight, GripVertical, Search } from 'lucide-react';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LibraryTemplate as BaseLibraryTemplate } from '@/lib/definitions';
export type LibraryTemplate = BaseLibraryTemplate & { order?: number };

interface TemplateTableProps {
  data: LibraryTemplate[];
  type: 'custom' | 'premade';
  onDeleteSelected: (ids: string[]) => void;
  onApproveSelected?: (ids: string[]) => void;
  onReorder?: (reorderedData: LibraryTemplate[]) => void;
}

export function TemplateTable({
  data,
  type,
  onDeleteSelected,
  onApproveSelected,
  onReorder,
}: TemplateTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const filteredData = useMemo(() => {
    if (!search) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.category.toLowerCase().includes(lowerSearch) ||
        t.language.toLowerCase().includes(lowerSearch)
    );
  }, [data, search]);

  const pageCount = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    // If we have drag-and-drop (premade), we might not want pagination to disrupt the whole list.
    // However, if the user requested pagination "if the lists grow large", we will paginate.
    const start = page * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredData.map((d) => d._id!.toString())));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = data.findIndex((x) => x._id!.toString() === active.id);
      const newIndex = data.findIndex((x) => x._id!.toString() === over.id);
      const newData = arrayMove(data, oldIndex, newIndex);
      if (onReorder) onReorder(newData);
    }
  };

  const selectedArray = Array.from(selectedIds);

  const SortableRow = ({ template }: { template: LibraryTemplate }) => {
    const id = template._id!.toString();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const isSelected = selectedIds.has(id);

    return (
      <ZoruTableRow ref={setNodeRef} style={style} className="hover:bg-zoru-surface transition-colors">
        <ZoruTableCell className="w-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(c) => toggleOne(id, !!c)}
          />
        </ZoruTableCell>
        {type === 'premade' && (
          <ZoruTableCell className="w-10 text-zoru-ink-muted cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </ZoruTableCell>
        )}
        <ZoruTableCell className="font-medium text-zoru-ink">{template.name}</ZoruTableCell>
        <ZoruTableCell>
          <span className="inline-flex items-center rounded-full border border-zoru-line bg-zoru-surface px-2 py-0.5 text-[10px] font-medium text-zoru-ink-muted">
            {template.category}
          </span>
        </ZoruTableCell>
        <ZoruTableCell className="text-zoru-ink-muted">{template.language}</ZoruTableCell>
      </ZoruTableRow>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              {type === 'custom' && onApproveSelected && (
                <Button variant="outline" size="sm" onClick={() => onApproveSelected(selectedArray)}>
                  Approve ({selectedIds.size})
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => onDeleteSelected(selectedArray)}>
                Delete ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead className="w-10">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === filteredData.length}
                onCheckedChange={(c) => toggleAll(!!c)}
              />
            </ZoruTableHead>
            {type === 'premade' && <ZoruTableHead className="w-10"></ZoruTableHead>}
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Category</ZoruTableHead>
            <ZoruTableHead>Language</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {type === 'premade' && !search ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={paginatedData.map((d) => d._id!.toString())} strategy={verticalListSortingStrategy}>
                {paginatedData.map((t) => (
                  <SortableRow key={t._id!.toString()} template={t} />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            paginatedData.map((t) => {
              const id = t._id!.toString();
              return (
                <ZoruTableRow key={id} className="hover:bg-zoru-surface transition-colors">
                  <ZoruTableCell className="w-10">
                    <Checkbox
                      checked={selectedIds.has(id)}
                      onCheckedChange={(c) => toggleOne(id, !!c)}
                    />
                  </ZoruTableCell>
                  {type === 'premade' && (
                    <ZoruTableCell className="w-10 text-zoru-ink-muted cursor-not-allowed">
                      <GripVertical className="h-4 w-4 opacity-50" />
                    </ZoruTableCell>
                  )}
                  <ZoruTableCell className="font-medium text-zoru-ink">{t.name}</ZoruTableCell>
                  <ZoruTableCell>
                    <span className="inline-flex items-center rounded-full border border-zoru-line bg-zoru-surface px-2 py-0.5 text-[10px] font-medium text-zoru-ink-muted">
                      {t.category}
                    </span>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted">{t.language}</ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
          {paginatedData.length === 0 && (
            <ZoruTableRow>
              <ZoruTableCell colSpan={type === 'premade' ? 5 : 4} className="h-24 text-center text-zoru-ink-muted">
                No templates found.
              </ZoruTableCell>
            </ZoruTableRow>
          )}
        </ZoruTableBody>
      </Table>

      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-zoru-ink-muted">
          Showing {paginatedData.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, filteredData.length)} of {filteredData.length} entries
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
