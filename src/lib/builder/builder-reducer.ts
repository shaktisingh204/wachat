import { Action, EditorState, ElementNode, PageData } from './builder-types';
import { v4 as uuidv4 } from 'uuid';

export const initialEditorState: EditorState = {
    page: {
        id: 'new-page',
        title: 'New Page',
        elements: [],
        settings: {},
    },
    selectedElementId: null,
    history: [],
    historyIndex: -1,
};

// Helper: Deep clone the page to avoid mutation
const clonePage = (page: PageData): PageData => JSON.parse(JSON.stringify(page));

// Helper: Find parent of a node and the node itself
const findNodeAndParent = (nodes: ElementNode[], id: string, parent: ElementNode | null = null): { node: ElementNode; parent: ElementNode | null } | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return { node, parent };
        }
        if (node.children) {
            const result = findNodeAndParent(node.children, id, node);
            if (result) return result;
        }
    }
    return null;
};

export function editorReducer(state: EditorState, action: Action): EditorState {
    // Handle History specific actions first to avoid recording them
    if (action.type === 'UNDO') {
        if (state.historyIndex > 0) {
            return {
                ...state,
                page: state.history[state.historyIndex - 1],
                historyIndex: state.historyIndex - 1,
            };
        }
        return state;
    }

    if (action.type === 'REDO') {
        if (state.historyIndex < state.history.length - 1) {
            return {
                ...state,
                page: state.history[state.historyIndex + 1],
                historyIndex: state.historyIndex + 1,
            };
        }
        return state;
    }

    // For all other modifications, we create a new history entry
    let newState = { ...state };
    const newPage = clonePage(state.page);

    switch (action.type) {
        case 'SELECT_ELEMENT':
            return { ...state, selectedElementId: action.payload };

        case 'SET_PAGE':
            return { ...state, page: action.payload, history: [action.payload], historyIndex: 0 };

        case 'ADD_ELEMENT': {
            const { parentId, element, index } = action.payload;
            if (parentId === 'root') {
                if (typeof index === 'number') {
                    newPage.elements.splice(index, 0, element);
                } else {
                    newPage.elements.push(element);
                }
            } else {
                const parentResult = findNodeAndParent(newPage.elements, parentId);
                if (parentResult) {
                    if (typeof index === 'number') {
                        parentResult.node.children.splice(index, 0, element);
                    } else {
                        parentResult.node.children.push(element);
                    }
                }
            }
            break;
        }

        case 'UPDATE_ELEMENT': {
            const { id, content, style } = action.payload;
            const result = findNodeAndParent(newPage.elements, id);
            if (result) {
                if (content) result.node.content = { ...result.node.content, ...content };
                if (style) result.node.style = { ...result.node.style, ...style };
            }
            break;
        }

        case 'DELETE_ELEMENT': {
            const idToDelete = action.payload;
            const result = findNodeAndParent(newPage.elements, idToDelete);

            if (result && result.parent) {
                result.parent.children = result.parent.children.filter(child => child.id !== idToDelete);
            } else if (result && !result.parent) {
                // Top level element
                newPage.elements = newPage.elements.filter(child => child.id !== idToDelete);
            }

            if (state.selectedElementId === idToDelete) {
                newState.selectedElementId = null;
            }
            break;
        }

        case 'MOVE_ELEMENT': {
            const { id, newParentId, index } = action.payload;
            // 1. Find and remove from old location
            const searchResult = findNodeAndParent(newPage.elements, id);
            if (!searchResult) return state; // Element not found

            const { node: nodeToMove, parent: oldParent } = searchResult;

            if (oldParent) {
                oldParent.children = oldParent.children.filter(child => child.id !== id);
            } else {
                newPage.elements = newPage.elements.filter(child => child.id !== id);
            }

            // 2. Add to new location
            if (newParentId === 'root') {
                newPage.elements.splice(index, 0, nodeToMove);
            } else {
                const newParentResult = findNodeAndParent(newPage.elements, newParentId);
                if (newParentResult) {
                    newParentResult.node.children.splice(index, 0, nodeToMove);
                }
            }
            break;
        }
    }

    // Update history
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newPage);

    return {
        ...newState,
        page: newPage,
        history: newHistory,
        historyIndex: newHistory.length - 1,
    };
}
