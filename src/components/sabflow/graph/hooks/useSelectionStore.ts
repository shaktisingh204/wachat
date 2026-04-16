import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Coordinates, Group, Edge } from '@/lib/sabflow/types';

type CoordinatesMap = Record<string, Coordinates>;

interface SelectionState {
  focusedElementsId: string[];
  elementsCoordinates: CoordinatesMap | undefined;
  elementsInClipboard: { groups: Group[]; edges: Edge[] } | undefined;
  isDraggingGraph: boolean;

  setIsDraggingGraph: (val: boolean) => void;
  focusElement: (id: string, addToSelection?: boolean) => void;
  /** Clears selection but keeps coordinates intact (Typebot pattern). */
  blurElements: () => void;
  setFocusedElements: (ids: string[]) => void;
  setElementsCoordinates: (coords: CoordinatesMap) => void;
  updateElementCoordinates: (id: string, coords: Coordinates) => void;
  moveFocusedElements: (delta: Coordinates) => void;
  getElementsCoordinates: () => CoordinatesMap | undefined;
  copyElements: (args: { groups: Group[]; edges: Edge[] }) => void;
}

export const useSelectionStore = create<SelectionState>()(
  immer((set, get) => ({
    focusedElementsId: [],
    elementsCoordinates: undefined,
    elementsInClipboard: undefined,
    isDraggingGraph: false,

    setIsDraggingGraph: (val) =>
      set((s) => {
        s.isDraggingGraph = val;
      }),

    focusElement: (id, addToSelection = false) =>
      set((s) => {
        if (addToSelection) {
          if (!s.focusedElementsId.includes(id)) s.focusedElementsId.push(id);
        } else {
          s.focusedElementsId = [id];
        }
      }),

    // Only clears selection — does NOT null out coordinates so subsequent
    // drags and edge calculations still work (Typebot pattern).
    blurElements: () =>
      set((s) => {
        s.focusedElementsId = [];
      }),

    setFocusedElements: (ids) =>
      set((s) => {
        s.focusedElementsId = ids;
      }),

    setElementsCoordinates: (coords) =>
      set((s) => {
        s.elementsCoordinates = coords;
      }),

    updateElementCoordinates: (id, coords) =>
      set((s) => {
        if (!s.elementsCoordinates) s.elementsCoordinates = {};
        s.elementsCoordinates[id] = coords;
      }),

    moveFocusedElements: (delta) =>
      set((s) => {
        if (!s.elementsCoordinates) return;
        s.focusedElementsId.forEach((id) => {
          const c = s.elementsCoordinates![id];
          if (!c) return;
          s.elementsCoordinates![id] = {
            x: Number((c.x + delta.x).toFixed(2)),
            y: Number((c.y + delta.y).toFixed(2)),
          };
        });
      }),

    getElementsCoordinates: () => get().elementsCoordinates,

    copyElements: (args) =>
      set((s) => {
        s.elementsInClipboard = args;
      }),
  })),
);
