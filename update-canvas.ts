import fs from 'fs';

let content = fs.readFileSync('src/components/email/journeys/canvas/journey-canvas.tsx', 'utf8');

// The new imports:
const newImports = `
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
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
`;

content = content.replace("import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';", "import { ArrowDown, ArrowUp, Plus, Trash2, GripVertical } from 'lucide-react';\n" + newImports.trim());

// Create SortableItem component
const sortableItemComp = `
function SortableJourneyNode({ 
  node, i, selectedNodeId, onSelect, readOnly, move, remove, nodesLength 
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: node.id, disabled: readOnly || node.type === 'trigger' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: transform ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex w-full flex-col items-center relative">
      <div className="flex w-full items-start gap-2 max-w-md">
        <div className="flex flex-col gap-1 mt-2">
           {(!readOnly && node.type !== 'trigger') ? (
              <div {...attributes} {...listeners} className="cursor-grab hover:bg-zoru-surface-2 p-1 rounded">
                 <GripVertical className="h-4 w-4 text-zoru-ink-muted" />
              </div>
           ) : <div className="w-6" />}
        </div>
        <div className="flex-1">
          <JourneyNodeCard
            node={node}
            index={i}
            selected={selectedNodeId === node.id}
            onSelect={() => onSelect(node.id)}
          />
        </div>
        {!readOnly && node.type !== 'trigger' ? (
          <div className="flex flex-col gap-1 mt-2">
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : <div className="w-8" />}
      </div>
      {i < nodesLength - 1 ? (
        <div aria-hidden className="h-6 w-px bg-border my-1" />
      ) : null}
    </div>
  );
}
`;

content = content.replace("export function JourneyCanvas({", sortableItemComp + "\nexport function JourneyCanvas({");

// Update JourneyCanvas
content = content.replace(/return \(\s*<div className="flex flex-col items-center gap-0">[\s\S]*?\)\s*\):\s*null\}\s*<\/div>\s*\);/m, `
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);
      
      // Prevent moving before or swapping with trigger node (index 0)
      if (oldIndex === 0 || newIndex === 0) return;

      const next = arrayMove(nodes, oldIndex, newIndex);
      onChange({ nodes: next, edges: relinkSequential(next) });
    }
  }

  return (
    <div className="flex flex-col items-center gap-0">
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-zoru-surface-2 px-6 py-12 text-center">
          <p className="text-sm text-zoru-ink-muted">This journey has no steps yet.</p>
        </div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={nodes.map(n => n.id)}
            strategy={verticalListSortingStrategy}
          >
            {nodes.map((node, i) => (
              <SortableJourneyNode
                key={node.id}
                node={node}
                i={i}
                selectedNodeId={selectedNodeId}
                onSelect={onSelect}
                readOnly={readOnly}
                move={move}
                remove={remove}
                nodesLength={nodes.length}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {!readOnly ? (
        <div className="mt-4">
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Add step
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="center">
              {ADDABLE_TYPES.map((k) => {
                const Icon = NODE_META[k].icon;
                return (
                  <ZoruDropdownMenuItem key={k} onSelect={() => add(k)}>
                    <Icon className="h-4 w-4" /> {NODE_META[k].label}
                  </ZoruDropdownMenuItem>
                );
              })}
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {edges.length > 0 ? (
        <p className="mt-6 text-[10px] text-zoru-ink-muted">
          {edges.length} edge{edges.length === 1 ? '' : 's'} rendered as a linear ladder. Branching from condition/split nodes
          is preserved in the underlying data and inspected in the side panel.
        </p>
      ) : null}
    </div>
  );
`);

fs.writeFileSync('src/components/email/journeys/canvas/journey-canvas.tsx', content);
