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
 *
 * UI: the dropdown is a 20ui `Menu` (keyboard + Escape + outside-click for
 * free) and the create/edit dialog is a 20ui `Modal` with `Field`/`Input`/
 * `Textarea`. The SabFiles logo picker and all project create/update logic
 * (including the standalone CRM-only project filter) are unchanged.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Plus, Pencil } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  createSabcrmProjectTw,
  updateSabcrmProjectTw,
  listSabcrmProjectsTw,
  type SabcrmProjectListItem,
} from '@/app/actions/sabcrm-twenty.actions';
import { SabFileUrlInput } from '@/components/sabfiles';
import {
  Button,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  Textarea,
} from '@/components/sabcrm/20ui';

/** First glyph of a name, for the square avatar tile. */
function avatarLetter(name: string | null | undefined): string {
  const ch = (name ?? '').trim().charAt(0);
  return ch ? ch.toUpperCase() : 'S';
}

const FORM_ID = 'st-ws-dialog-form';

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

  // Dialog mode: null = closed, 'create' = new project, 'edit' = active project.
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit' | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Shared create/edit form fields.
  const [formName, setFormName] = React.useState('');
  const [formLogo, setFormLogo] = React.useState('');
  const [formWebsite, setFormWebsite] = React.useState('');
  const [formIndustry, setFormIndustry] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');

  const inputRef = React.useRef<HTMLInputElement>(null);

  // SabCRM projects are STANDALONE from other modules' projects. We read them
  // (with their `sabcrm` profile: logo + details) straight from Mongo via
  // `listSabcrmProjectsTw`, independent of the shared Rust projects list — so
  // the CRM never shows WhatsApp/Facebook projects, and vice-versa.
  const [crmProjects, setCrmProjects] = React.useState<SabcrmProjectListItem[]>([]);

  const reloadCrmProjects = React.useCallback(async () => {
    const res = await listSabcrmProjectsTw();
    setCrmProjects(res.ok ? res.data : []);
  }, []);

  React.useEffect(() => {
    void reloadCrmProjects();
  }, [reloadCrmProjects, projects]);

  const activeCrm = React.useMemo(
    () => crmProjects.find((p) => p.id === activeProjectId) ?? null,
    [crmProjects, activeProjectId],
  );
  const activeIsCrm = !!activeCrm;

  const displayName = activeIsCrm
    ? (activeCrm?.name ?? activeProject?.name ?? activeProjectName ?? 'Select project')
    : (crmProjects.length > 0 ? 'Select project' : 'No CRM project');

  const activeLogo = activeCrm?.logoUrl;

  // Auto-select the first CRM project when the active project isn't a CRM one
  // (e.g. the user arrived from another module). Keeps the CRM scoped to its
  // own standalone project set.
  React.useEffect(() => {
    if (!activeIsCrm && crmProjects.length > 0) {
      setActiveProjectId(crmProjects[0].id);
    }
  }, [activeIsCrm, crmProjects, setActiveProjectId]);

  // Focus the name field whenever a dialog opens.
  React.useEffect(() => {
    if (!dialogMode) return;
    setError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [dialogMode]);

  const handleSelect = (projectId: string) => {
    if (projectId !== activeProjectId) {
      setActiveProjectId(projectId);
      router.refresh();
    }
  };

  const openCreateDialog = () => {
    setFormName('');
    setFormLogo('');
    setFormWebsite('');
    setFormIndustry('');
    setFormDescription('');
    setDialogMode('create');
  };

  const openEditDialog = () => {
    setFormName(activeCrm?.name ?? '');
    setFormLogo(activeCrm?.logoUrl ?? '');
    setFormWebsite(activeCrm?.website ?? '');
    setFormIndustry(activeCrm?.industry ?? '');
    setFormDescription(activeCrm?.description ?? '');
    setDialogMode('edit');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const profile = {
      logoUrl: formLogo.trim(),
      website: formWebsite.trim(),
      industry: formIndustry.trim(),
      description: formDescription.trim(),
    };

    if (dialogMode === 'edit' && activeProjectId) {
      const result = await updateSabcrmProjectTw(activeProjectId, { name, profile });
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await Promise.all([reloadProjects(), reloadCrmProjects()]);
      setDialogMode(null);
      router.refresh();
      return;
    }

    const result = await createSabcrmProjectTw(name, profile);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await Promise.all([reloadProjects(), reloadCrmProjects()]);
    setActiveProjectId(result.data.projectId);
    setDialogMode(null);
    router.refresh();
  };

  return (
    <div className="st-ws">
      <Menu
        align="start"
        label={`Workspace: ${displayName}`}
        trigger={
          <button
            type="button"
            className="st-workspace-switcher"
            aria-label={`Workspace: ${displayName}`}
          >
            <span className="st-workspace-switcher__avatar" aria-hidden="true">
              {activeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLogo} alt="" className="st-ws-logo" />
              ) : (
                avatarLetter(displayName)
              )}
            </span>
            <span className="st-workspace-switcher__name">{displayName}</span>
            <ChevronDown
              className="st-workspace-switcher__chevron"
              size={14}
              aria-hidden="true"
            />
          </button>
        }
      >
        <div className="st-ws-menu__header">
          <span className="st-ws-menu__avatar" aria-hidden="true">
            {activeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeLogo} alt="" className="st-ws-logo" />
            ) : (
              avatarLetter(displayName)
            )}
          </span>
          <span className="st-ws-menu__title">{displayName}</span>
        </div>

        {activeIsCrm && (
          <MenuItem icon={Pencil} onSelect={openEditDialog}>
            Edit project
          </MenuItem>
        )}

        {crmProjects.length === 0 ? (
          <div className="st-ws-menu__empty">No CRM projects yet</div>
        ) : (
          crmProjects.map((project) => {
            const id = project.id;
            const selected = id === activeProjectId;
            const logo = project.logoUrl;
            return (
              <MenuItem
                key={id}
                role="menuitemradio"
                aria-checked={selected}
                onSelect={() => handleSelect(id)}
                hint={
                  selected ? (
                    <Check className="st-ws-menu__check" size={15} aria-hidden="true" />
                  ) : undefined
                }
              >
                <span className="st-ws-menu__item-row">
                  <span className="st-ws-menu__item-avatar" aria-hidden="true">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="st-ws-logo" />
                    ) : (
                      avatarLetter(project.name)
                    )}
                  </span>
                  <span className="st-ws-menu__item-name">{project.name || 'Untitled'}</span>
                </span>
              </MenuItem>
            );
          })
        )}

        <MenuSeparator />

        <MenuItem icon={Plus} onSelect={openCreateDialog}>
          Create project
        </MenuItem>
      </Menu>

      <Modal
        open={dialogMode !== null}
        onClose={() => {
          if (!submitting) setDialogMode(null);
        }}
        title={dialogMode === 'edit' ? 'Edit project' : 'Create project'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDialogMode(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form={FORM_ID}
              loading={submitting}
              disabled={!formName.trim()}
            >
              {dialogMode === 'edit' ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} className="st-ws-form" onSubmit={handleSubmit}>
          <Field label="Project name" error={error ?? undefined}>
            <Input
              ref={inputRef}
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder="e.g. Acme Sales"
              maxLength={120}
              disabled={submitting}
              autoComplete="off"
            />
          </Field>

          <Field label="Logo">
            <SabFileUrlInput
              value={formLogo}
              onChange={(v) => setFormLogo(v)}
              accept="image"
              pickerTitle="Choose a project logo"
              placeholder="No logo chosen"
              disabled={submitting}
            />
          </Field>

          <Field label="Industry">
            <Input
              value={formIndustry}
              onChange={(event) => setFormIndustry(event.target.value)}
              placeholder="e.g. SaaS, Real Estate"
              maxLength={120}
              disabled={submitting}
              autoComplete="off"
            />
          </Field>

          <Field label="Website">
            <Input
              value={formWebsite}
              onChange={(event) => setFormWebsite(event.target.value)}
              placeholder="https://"
              maxLength={300}
              disabled={submitting}
              autoComplete="off"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              placeholder="A short description of this CRM workspace"
              maxLength={2000}
              disabled={submitting}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

export default TwentyWorkspaceSwitcher;
