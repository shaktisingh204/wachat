/**
 * NodeContextMenu
 *
 * Public alias for GroupNodeContextMenu.
 * Import from here when you need the context menu outside of the group node
 * subtree (e.g. from GraphElements or a higher-level canvas component).
 *
 * Props:
 *   groupId       — ID of the group being right-clicked
 *   flow          — current SabFlowDoc (groups + edges subset)
 *   onFlowChange  — callback to commit mutations
 *   onFocusGroup? — optional: pan/zoom the canvas to the given group
 */
export { GroupNodeContextMenu as NodeContextMenu } from './nodes/group/GroupNodeContextMenu';
