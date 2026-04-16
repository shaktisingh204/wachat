import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Coordinates } from '@/lib/sabflow/types';

type ElementsCoordinates = Record<string, Coordinates>;

interface SelectionState {
  focusedElementsId: string[];
  elementsCoordinates: ElementsCoordinates | null;
  isDraggingGraph: boolean;

  setIsDraggingGraph: (val: boolean) => void;
  focusElement: (id: string, addToSelection?: boolean) => void;
  blurElements: () => void;
  setFocusedElements: (ids: string[]) => void;
  setElementsCoordinates: (coords: ElementsCoordinates) => void;
  updateElementCoordinates: (id: string, coords: Coordinates) => void;
  moveFocusedElements: (delta: Coordinates) => void;
  getElementsCoordinates: () => ElementsCoordinates | null;
}

export const useSelectionStore = create<SelectionState>()(
  immer((set, get) => ({
    focusedElementsId: [],
    elementsCoordinates: null,
    isDraggingGraph: false,

    setIsDraggingGraph: (val) => set((s) => { s.isDraggingGraph = val; }),

    focusElement: (id, addToSelection = false) =>
      set((s) => {
        if (addToSelection) {
          if (!s.focusedElementsId.includes(id)) s.focusedElementsId.push(id);
        } else {
          s.focusedElementsId = [id];
        }
      }),

    blurElements: () => set((s) => { s.focusedElementsId = []; s.elementsCoordinates = null; }),

    setFocusedElements: (ids) => set((s) => { s.focusedElementsId = ids; }),

    setElementsCoordinates: (coords) => set((s) => { s.elementsCoordinates = coords; }),

    updateElementCoordinates: (id, coords) =>
      set((s) => {
        if (!s.elementsCoordinates) s.elementsCoordinates = {};
        s.elementsCoordinates[id] = coords;
      }),

    moveFocusedElements: (delta) =>
      set((s) => {
        if (!s.elementsCoordinates) return;
        s.focusedElementsId.forEach((id) => {
          if (s.elementsCoordinates![id]) {
            s.elementsCoordinates![id].x += delta.x;
            s.elementsCoordinates![id].y += delta.y;
          }
        });
      }),

    getElementsCoordinates: () => get().elementsCoordinates,
  })),
);
