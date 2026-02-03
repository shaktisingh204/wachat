
export type ElementType = 'SECTION' | 'COLUMN' | 'WIDGET';
export type WidgetType = 'HEADING' | 'TEXT' | 'IMAGE' | 'BUTTON' | 'SPACER';

export interface ElementNode {
    id: string;
    type: ElementType;
    widgetType?: WidgetType;
    content: Record<string, any>;
    style: Record<string, any>;
    children: ElementNode[];
}

export interface PageData {
    id: string;
    title: string;
    elements: ElementNode[];
    settings: Record<string, any>;
}

export interface EditorState {
    page: PageData;
    selectedElementId: string | null;
    history: PageData[]; // Simple history stack for undo
    historyIndex: number;
}

export type Action =
    | { type: 'SELECT_ELEMENT'; payload: string | null }
    | { type: 'ADD_ELEMENT'; payload: { parentId: string; element: ElementNode; index?: number } }
    | { type: 'UPDATE_ELEMENT'; payload: { id: string; content?: any; style?: any } }
    | { type: 'DELETE_ELEMENT'; payload: string }
    | { type: 'MOVE_ELEMENT'; payload: { id: string; newParentId: string; index: number } }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET_PAGE'; payload: PageData };
