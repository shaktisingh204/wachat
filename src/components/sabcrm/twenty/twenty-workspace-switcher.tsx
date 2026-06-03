'use client';

/**
 * TwentyWorkspaceSwitcher — SabCRM's project switcher + creator.
 *
 * A faithful clone of upstream Twenty's `MultiWorkspaceDropdown`
 * (twenty-front `.../MultiWorkspaceDropdown/*`), mapping Twenty's
 * "workspace" onto SabNode's "project". It owns the sidebar header's
 * clickable trigger (avatar + active-project name + chevron), a dropdown
 * listing every project (click to switch, check on the active one), and a
 * "Create project" action that opens a Twenty-styled dialog — the analogue
 * of Twenty's `signUpInNewWorkspace` "Create Workspace" flow.
 *
 * Selecting a project writes through `useProject().setActiveProjectId`
 * (persisted to localStorage by the context) so every project-scoped
 * SabCRM page resolves a project instead of rendering its
 * "No project selected" empty state. On mount, if nothing is selected yet
 * but projects exist, the first is auto-selected — matching the server
 * `gate()` which also defaults to the user's first project.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Plus, X } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { createSabcrmProjectTw } from '@/app/actions/sabcrm-twenty.actions';

/** First glyph of a name, for the square avatar tile. */
function avatarLetter(name: string | null | undefined): string {
  const ch = (name ?? '').trim().charAt(0);
  return ch ? ch.toUpperCase() : 'S';
}

export function TwentyWorkspaceSwitcher(): React.JSX.Element {
  const router = useRouter();
  const {
    projects,
    activeProject,
    activeProjectId,
    activeProjectName,
    setActiveProjectId,
    reloadProjects,
  } = useProject();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const displayName =
    activeProject?.name ?? activeProjectName ?? 'Select project';

  // Auto-select the first project when none is active yet — keeps the client
  // in step with the server gate (which defaults to the user's first project)
  // so pages stop flashing their "No project selected" state.
  React.useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0]._id.toString());
    }
  }, [activeProjectId, projects, setActiveProjectId]);

  // Close the dropdown on an outside click.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  // Reset + focus the field whenever the create dialog opens.
  React.useEffect(() => {
    if (!dialogOpen) return;
    setNewName('');
    setError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [dialogOpen]);

  const handleSelect = (projectId: string) => {
    if (projectId !== activeProjectId) {
      setActiveProjectId(projectId);
      router.refresh();
    }
    setMenuOpen(false);
  };

  const openCreateDialog = () => {
    setMenuOpen(false);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createSabcrmProjectTw(name);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reloadProjects();
    setActiveProjectId(result.data.projectId);
    setDialogOpen(false);
    router.refresh();
  };

  return (
    <div className="st-ws" ref={rootRef}>
      <button
        type="button"
        className="st-workspace-switcher"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Workspace: ${displayName}`}
      >
        <span className="st-workspace-switcher__avatar" aria-hidden="true">
          {avatarLetter(displayName)}
        </span>
        <span className="st-workspace-switcher__name">{displayName}</span>
        <ChevronDown
          className="st-workspace-switcher__chevron"
          size={14}
          aria-hidden="true"
        />
      </button>

      {menuOpen && (
        <div className="st-ws-menu" role="menu">
          <div className="st-ws-menu__header">
            <span className="st-ws-menu__avatar" aria-hidden="true">
              {avatarLetter(displayName)}
            </span>
            <span className="st-ws-menu__title">{displayName}</span>
          </div>

          <div className="st-ws-menu__section">
            {projects.length === 0 ? (
              <div className="st-ws-menu__empty">No projects yet</div>
            ) : (
              projects.map((project) => {
                const id = project._id.toString();
                const selected = id === activeProjectId;
                return (
                  <button
                    key={id}
                    type="button"
                    className="st-ws-menu__item"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => handleSelect(id)}
                  >
                    <span className="st-ws-menu__item-avatar" aria-hidden="true">
                      {avatarLetter(project.name)}
                    </span>
                    <span className="st-ws-menu__item-label">
                      {project.name || 'Untitled'}
                    </span>
                    {selected && (
                      <Check className="st-ws-menu__check" size={15} aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="st-ws-menu__sep" />

          <button
            type="button"
            className="st-ws-menu__item"
            role="menuitem"
            onClick={openCreateDialog}
          >
            <span className="st-ws-menu__item-icon" aria-hidden="true">
              <Plus size={15} />
            </span>
            <span className="st-ws-menu__item-label">Create project</span>
          </button>
        </div>
      )}

      {dialogOpen && (
        <div
          className="st-dialog-overlay"
          onClick={() => {
            if (!submitting) setDialogOpen(false);
          }}
        >
          <div
            className="st-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="st-ws-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="st-dialog__header">
                <h2 className="st-dialog__title" id="st-ws-dialog-title">
                  Create project
                </h2>
                <button
                  type="button"
                  className="st-dialog__close"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                  aria-label="Close"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="st-dialog__body">
                <label className="st-ws-field-label" htmlFor="st-ws-name">
                  Project name
                </label>
                <input
                  id="st-ws-name"
                  ref={inputRef}
                  className="st-input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Acme Sales"
                  maxLength={120}
                  disabled={submitting}
                  autoComplete="off"
                />
                {error && <p className="st-ws-error">{error}</p>}
              </div>
              <div className="st-dialog__footer">
                <button
                  type="button"
                  className="st-btn st-btn--secondary"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="st-btn st-btn--primary"
                  disabled={submitting || !newName.trim()}
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TwentyWorkspaceSwitcher;
