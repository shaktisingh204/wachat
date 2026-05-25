import { create } from 'zustand';
import { LibraryTemplate } from '@/lib/definitions';

interface TemplateStore {
  templateToAction: LibraryTemplate | null;
  setTemplateToAction: (template: LibraryTemplate | null) => void;
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  templateToAction: null,
  setTemplateToAction: (template) => set({ templateToAction: template }),
}));
