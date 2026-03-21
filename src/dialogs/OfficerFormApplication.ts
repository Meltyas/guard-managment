// @ts-nocheck
/**
 * OfficerFormApplication
 * Custom FormApplication for creating/editing officers with proper validation
 */

import type { GuardStats } from '../types/entities';
import type { Officer, OfficerSkill, OfficerTrait } from '../types/officer';

interface OfficerFormData {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  stats: Partial<GuardStats>;
  skills: OfficerSkill[];
  pros: OfficerTrait[];
  cons: OfficerTrait[];
  organizationId: string;
  visibleToPlayers: boolean;
}

export class OfficerFormApplication extends FormApplication {
  private mode: 'create' | 'edit';
  private organizationId: string;
  private existingOfficer?: Officer;
  private currentData: Partial<OfficerFormData>;
  private resolvePromise?: (officer: Officer | null) => void;

  constructor(
    mode: 'create' | 'edit',
    organizationId: string,
    existingOfficer?: Officer,
    options?: any
  ) {
    super({}, options);
    this.mode = mode;
    this.organizationId = organizationId;
    this.existingOfficer = existingOfficer;

    // Initialize current data
    this.currentData = {
      actorId: existingOfficer?.actorId || '',
      actorName: existingOfficer?.actorName || '',
      actorImg: existingOfficer?.actorImg || '',
      title: existingOfficer?.title || '',
      stats: existingOfficer?.stats || {},
      skills: existingOfficer?.skills ? [...existingOfficer.skills] : [],
      pros: existingOfficer?.pros || [],
      cons: existingOfficer?.cons || [],
      organizationId: existingOfficer?.organizationId || organizationId,
      visibleToPlayers: existingOfficer?.visibleToPlayers ?? false,
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['guard-management', 'officer-form-app'],
      template: 'modules/guard-management/templates/dialogs/add-edit-officer.hbs',
      width: 620,
      height: 'auto',
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: false,
      submitOnChange: false,
    });
  }

  get title() {
    return this.mode === 'create' ? 'Crear Oficial' : 'Editar Oficial';
  }

  async getData() {
    const data = await super.getData();

    return {
      ...data,
      mode: this.mode,
      ...this.currentData,
      organizationId: this.organizationId,
    };
  }

  activateListeners(html: JQuery) {
    super.activateListeners(html);

    // Setup actor drop zone and clear button
    this.setupActorDropZone(html);
    this.setupActorClearButton(html);

    // Setup officer skills (multiple)
    this.setupSkillButtons(html);
    this.setupSkillRemoveButtons(html);
    this.setupSkillEditButtons(html);

    // Setup trait buttons
    this.setupTraitButtons(html);
    this.setupTraitRemoveButtons(html);
    this.setupTraitEditButtons(html);

    // Cancel button
    html.find('.cancel-button').on('click', () => {
      this.resolvePromise?.(null);
      this.close();
    });
  }

  /** Sync title (and visibleToPlayers) from DOM into currentData before re-rendering */
  private syncFormFields(): void {
    const el =
      this.element instanceof $ ? (this.element as JQuery)[0] : (this.element as HTMLElement);
    if (!el) return;
    const titleInput = el.querySelector('#officer-title') as HTMLInputElement | null;
    if (titleInput) this.currentData.title = titleInput.value;
    const visibleCheck = el.querySelector(
      'input[name="visibleToPlayers"]'
    ) as HTMLInputElement | null;
    if (visibleCheck) this.currentData.visibleToPlayers = visibleCheck.checked;
    // Sync stats
    const stats: Partial<GuardStats> = {};
    for (const key of ['robustismo', 'analitica', 'subterfugio', 'elocuencia']) {
      const input = el.querySelector(`input[name="stat-${key}"]`) as HTMLInputElement | null;
      if (input) stats[key] = parseInt(input.value || '0', 10) || 0;
    }
    this.currentData.stats = stats;
  }

  private setupActorDropZone(html: JQuery) {
    const dropZone =
      html.find('.officer-actor-dropzone')[0] || html.find('.officer-actor-preview')[0];
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (event: DragEvent) => {
      event.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (event: DragEvent) => {
      event.preventDefault();
      dropZone.classList.remove('drag-over');

      try {
        const dataStr = event.dataTransfer?.getData('text/plain');
        if (!dataStr) return;

        const data = JSON.parse(dataStr);
        if (data.type !== 'Actor') return;

        const actor = await fromUuid(data.uuid);
        if (!actor) return;

        this.currentData.actorId = actor.id;
        this.currentData.actorName = actor.name;
        this.currentData.actorImg = actor.img;

        this.render(false);
      } catch (error) {
        console.error('Error handling actor drop:', error);
      }
    });
  }

  private setupActorClearButton(html: JQuery) {
    html.find('.officer-actor-clear-btn').on('click', (event) => {
      event.preventDefault();
      this.currentData.actorId = '';
      this.currentData.actorName = '';
      this.currentData.actorImg = '';
      this.syncFormFields();
      this.render(false);
    });
  }

  // ── Skills ──────────────────────────────────────────────────────────────────

  private setupSkillButtons(html: JQuery) {
    html.find('.add-skill-btn').on('click', async (event) => {
      event.preventDefault();
      await this.showAddSkillDialog();
    });
  }

  private setupSkillRemoveButtons(html: JQuery) {
    html.find('.skill-remove-btn').on('click', (event) => {
      event.preventDefault();
      const skillId = $(event.currentTarget).data('skill-id');
      this.removeSkill(skillId);
    });
  }

  private async showAddSkillDialog() {
    const DialogV2Class = foundry.applications?.api?.DialogV2;
    if (!DialogV2Class) return;

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label>Nombre <span style="color:#e84a4a">*</span></label>
          <input type="text" id="skill-name" placeholder="Ej: Tácticas Avanzadas, Don de Mando..." autofocus />
        </div>
        <div class="form-group">
          <label>Imagen</label>
          <div class="file-picker-wrapper">
            <input type="text" id="skill-image" placeholder="icons/..." />
            <button type="button" id="skill-image-picker-btn" class="file-picker-btn" title="Seleccionar imagen">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Coste de Hope (0–5)</label>
          <input type="number" id="skill-hope-cost" value="0" min="0" max="5" style="width:80px;" />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="skill-description" rows="3" style="width:100%;resize:vertical;" placeholder="Describe el efecto de esta habilidad..."></textarea>
        </div>
      </div>
    `;

    let resolvedName = '';
    let resolvedImage = '';
    let resolvedHopeCost = 0;
    let resolvedDescription = '';

    const result = await DialogV2Class.wait({
      window: { title: 'Agregar Habilidad' },
      content,
      render: (event: any, dialog: any) => {
        // Wire up file picker button inside dialog
        const pickerBtn = dialog.element?.querySelector('#skill-image-picker-btn');
        if (pickerBtn) {
          pickerBtn.addEventListener('click', () => {
            const imageInput = dialog.element?.querySelector('#skill-image') as HTMLInputElement;
            const picker = new FilePicker({
              type: 'image',
              current: imageInput?.value || '',
              callback: (path: string) => {
                if (imageInput) imageInput.value = path;
              },
            });
            picker.browse();
          });
        }
      },
      buttons: [
        {
          action: 'add',
          icon: 'fas fa-plus',
          label: 'Agregar',
          callback: (event: any, button: any, dialog: any) => {
            const nameInput = dialog.element?.querySelector('#skill-name') as HTMLInputElement;
            const imageInput = dialog.element?.querySelector('#skill-image') as HTMLInputElement;
            const hopeCostInput = dialog.element?.querySelector(
              '#skill-hope-cost'
            ) as HTMLInputElement;
            const descInput = dialog.element?.querySelector(
              '#skill-description'
            ) as HTMLTextAreaElement;

            const name = nameInput?.value?.trim();
            if (!name) {
              ui.notifications?.error('El nombre de la habilidad es obligatorio');
              return false;
            }

            resolvedName = name;
            resolvedImage = imageInput?.value?.trim() || '';
            resolvedHopeCost = Math.min(
              5,
              Math.max(0, parseInt(hopeCostInput?.value || '0', 10) || 0)
            );
            resolvedDescription = descInput?.value?.trim() || '';
            return 'add';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'add' && resolvedName) {
      const newSkill: OfficerSkill = {
        id: foundry.utils.randomID(),
        name: resolvedName,
        description: resolvedDescription || undefined,
        image: resolvedImage || undefined,
        hopeCost: resolvedHopeCost,
      };
      this.currentData.skills = [...(this.currentData.skills || []), newSkill];
      this.syncFormFields();
      this.render(false);
    }
  }

  private removeSkill(skillId: string) {
    this.currentData.skills = (this.currentData.skills || []).filter((s) => s.id !== skillId);
    this.syncFormFields();
    this.render(false);
  }

  private setupSkillEditButtons(html: JQuery) {
    html.find('.skill-edit-btn').on('click', async (event) => {
      event.preventDefault();
      const skillId = $(event.currentTarget).data('skill-id');
      const skill = (this.currentData.skills || []).find((s) => s.id === skillId);
      if (skill) await this.showEditSkillDialog(skill);
    });
  }

  private async showEditSkillDialog(skill: OfficerSkill) {
    const DialogV2Class = foundry.applications?.api?.DialogV2;
    if (!DialogV2Class) return;

    const escapedDesc = (skill.description || '')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label>Nombre <span style="color:#e84a4a">*</span></label>
          <input type="text" id="skill-name" value="${skill.name.replace(/"/g, '&quot;')}" autofocus />
        </div>
        <div class="form-group">
          <label>Imagen</label>
          <div class="file-picker-wrapper">
            <input type="text" id="skill-image" value="${(skill.image || '').replace(/"/g, '&quot;')}" placeholder="icons/..." />
            <button type="button" id="skill-image-picker-btn" class="file-picker-btn" title="Seleccionar imagen">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Coste de Hope (0–5)</label>
          <input type="number" id="skill-hope-cost" value="${skill.hopeCost}" min="0" max="5" style="width:80px;" />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="skill-description" rows="3" style="width:100%;resize:vertical;" placeholder="Describe el efecto de esta habilidad...">${escapedDesc}</textarea>
        </div>
      </div>
    `;

    let resolvedName = '';
    let resolvedImage = '';
    let resolvedHopeCost = 0;
    let resolvedDescription = '';

    const result = await DialogV2Class.wait({
      window: { title: 'Editar Habilidad' },
      content,
      render: (event: any, dialog: any) => {
        const pickerBtn = dialog.element?.querySelector('#skill-image-picker-btn');
        if (pickerBtn) {
          pickerBtn.addEventListener('click', () => {
            const imageInput = dialog.element?.querySelector('#skill-image') as HTMLInputElement;
            const picker = new FilePicker({
              type: 'image',
              current: imageInput?.value || '',
              callback: (path: string) => {
                if (imageInput) imageInput.value = path;
              },
            });
            picker.browse();
          });
        }
      },
      buttons: [
        {
          action: 'save',
          icon: 'fas fa-save',
          label: 'Guardar',
          callback: (event: any, button: any, dialog: any) => {
            const nameInput = dialog.element?.querySelector('#skill-name') as HTMLInputElement;
            const imageInput = dialog.element?.querySelector('#skill-image') as HTMLInputElement;
            const hopeCostInput = dialog.element?.querySelector(
              '#skill-hope-cost'
            ) as HTMLInputElement;
            const descInput = dialog.element?.querySelector(
              '#skill-description'
            ) as HTMLTextAreaElement;

            const name = nameInput?.value?.trim();
            if (!name) {
              ui.notifications?.error('El nombre de la habilidad es obligatorio');
              return false;
            }

            resolvedName = name;
            resolvedImage = imageInput?.value?.trim() || '';
            resolvedHopeCost = Math.min(
              5,
              Math.max(0, parseInt(hopeCostInput?.value || '0', 10) || 0)
            );
            resolvedDescription = descInput?.value?.trim() || '';
            return 'save';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'save' && resolvedName) {
      this.currentData.skills = (this.currentData.skills || []).map((s) =>
        s.id === skill.id
          ? {
              ...s,
              name: resolvedName,
              description: resolvedDescription || undefined,
              image: resolvedImage || undefined,
              hopeCost: resolvedHopeCost,
            }
          : s
      );
      this.syncFormFields();
      this.render(false);
    }
  }

  // ── Traits ──────────────────────────────────────────────────────────────────

  private setupTraitButtons(html: JQuery) {
    html.find('.add-trait-btn').on('click', async (event) => {
      event.preventDefault();
      const traitType = $(event.currentTarget).data('trait-type') as 'pro' | 'con';
      await this.showAddTraitDialog(traitType);
    });
  }

  private setupTraitRemoveButtons(html: JQuery) {
    html.find('.trait-remove-btn').on('click', (event) => {
      event.preventDefault();
      const traitId = $(event.currentTarget).data('trait-id');
      const traitType = $(event.currentTarget).data('trait-type') as 'pro' | 'con';
      this.removeTrait(traitType, traitId);
    });
  }

  private async showAddTraitDialog(type: 'pro' | 'con') {
    const DialogV2Class = foundry.applications?.api?.DialogV2;
    if (!DialogV2Class) return;

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label>Título <span style="color:#e84a4a">*</span></label>
          <input type="text" id="trait-title" autofocus />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="trait-description" rows="4"></textarea>
        </div>
      </div>
    `;

    let editorContent = '';
    let resolvedTitle = '';

    const result = await DialogV2Class.wait({
      window: { title: type === 'pro' ? 'Agregar Pro' : 'Agregar Con' },
      content,
      buttons: [
        {
          action: 'add',
          icon: 'fas fa-plus',
          label: 'Agregar',
          callback: (event: any, button: any, dialog: any) => {
            const titleInput = dialog.element?.querySelector('#trait-title') as HTMLInputElement;
            const descInput = dialog.element?.querySelector(
              '#trait-description'
            ) as HTMLTextAreaElement;

            const title = titleInput?.value?.trim();
            editorContent = descInput?.value || '';

            if (!title) {
              ui.notifications?.error('El título es obligatorio');
              return false;
            }

            resolvedTitle = title;
            return 'add';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'add' && resolvedTitle) {
      const newTrait: OfficerTrait = {
        id: foundry.utils.randomID(),
        title: resolvedTitle,
        description: editorContent,
        createdAt: new Date(),
      };

      if (type === 'pro') {
        this.currentData.pros = [...(this.currentData.pros || []), newTrait];
      } else {
        this.currentData.cons = [...(this.currentData.cons || []), newTrait];
      }
      this.syncFormFields();
      this.render(false);
    }
  }

  private removeTrait(type: 'pro' | 'con', traitId: string) {
    if (type === 'pro') {
      this.currentData.pros = (this.currentData.pros || []).filter((p) => p.id !== traitId);
    } else {
      this.currentData.cons = (this.currentData.cons || []).filter((c) => c.id !== traitId);
    }
    this.syncFormFields();
    this.render(false);
  }

  private setupTraitEditButtons(html: JQuery) {
    html.find('.trait-edit-btn').on('click', async (event) => {
      event.preventDefault();
      const traitId = $(event.currentTarget).data('trait-id');
      const traitType = $(event.currentTarget).data('trait-type') as 'pro' | 'con';
      const list = traitType === 'pro' ? this.currentData.pros : this.currentData.cons;
      const trait = (list || []).find((t) => t.id === traitId);
      if (trait) await this.showEditTraitDialog(traitType, trait);
    });
  }

  private async showEditTraitDialog(type: 'pro' | 'con', trait: OfficerTrait) {
    const DialogV2Class = foundry.applications?.api?.DialogV2;
    if (!DialogV2Class) return;

    const escapedTitle = trait.title.replace(/"/g, '&quot;');
    const escapedDesc = trait.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const content = `
      <div class="guard-dialog" style="padding: 0.5rem;">
        <div class="form-group">
          <label>Título <span style="color:#e84a4a">*</span></label>
          <input type="text" id="trait-title" value="${escapedTitle}" autofocus />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="trait-description" rows="4">${escapedDesc}</textarea>
        </div>
      </div>
    `;

    let resolvedTitle = '';
    let editorContent = '';

    const result = await DialogV2Class.wait({
      window: { title: type === 'pro' ? 'Editar Pro' : 'Editar Con' },
      content,
      buttons: [
        {
          action: 'save',
          icon: 'fas fa-save',
          label: 'Guardar',
          callback: (event: any, button: any, dialog: any) => {
            const titleInput = dialog.element?.querySelector('#trait-title') as HTMLInputElement;
            const descInput = dialog.element?.querySelector(
              '#trait-description'
            ) as HTMLTextAreaElement;

            const title = titleInput?.value?.trim();
            editorContent = descInput?.value || '';

            if (!title) {
              ui.notifications?.error('El título es obligatorio');
              return false;
            }

            resolvedTitle = title;
            return 'save';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'save' && resolvedTitle) {
      const update = (list: OfficerTrait[]) =>
        list.map((t) =>
          t.id === trait.id ? { ...t, title: resolvedTitle, description: editorContent } : t
        );

      if (type === 'pro') {
        this.currentData.pros = update(this.currentData.pros || []);
      } else {
        this.currentData.cons = update(this.currentData.cons || []);
      }
      this.syncFormFields();
      this.render(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async _updateObject(_event: Event, formData: any) {
    if (!formData.title?.trim()) {
      ui.notifications?.error('El título es obligatorio');
      return;
    }

    // Sync stats from form inputs
    this.syncFormFields();

    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) {
      console.error('OfficerManager not available');
      ui.notifications?.error('Sistema de oficiales no disponible');
      return;
    }

    try {
      let officer: Officer;

      if (this.mode === 'create') {
        officer = await gm.officerManager.create({
          actorId: this.currentData.actorId!,
          actorName: this.currentData.actorName!,
          actorImg: this.currentData.actorImg,
          title: formData.title.trim(),
          stats: this.currentData.stats || {},
          skills: (this.currentData.skills || []).map((s) => ({
            name: s.name,
            description: s.description,
            image: s.image,
            hopeCost: s.hopeCost,
          })),
          pros: (this.currentData.pros || []).map((p: OfficerTrait) => ({
            title: p.title,
            description: p.description,
          })),
          cons: (this.currentData.cons || []).map((c: OfficerTrait) => ({
            title: c.title,
            description: c.description,
          })),
          organizationId: this.currentData.organizationId!,
          visibleToPlayers: formData.visibleToPlayers ?? false,
        });

        ui.notifications?.info(`Oficial "${this.currentData.actorName}" creado`);
      } else {
        const updated = gm.officerManager.update(this.existingOfficer!.id, {
          actorId: this.currentData.actorId || '',
          actorName: this.currentData.actorName || '',
          actorImg: this.currentData.actorImg || undefined,
          title: formData.title.trim(),
          stats: this.currentData.stats || {},
          skills: this.currentData.skills || [],
          pros: this.currentData.pros,
          cons: this.currentData.cons,
          organizationId: this.currentData.organizationId,
          visibleToPlayers: formData.visibleToPlayers ?? false,
        });

        if (!updated) {
          ui.notifications?.error('No se pudo actualizar el oficial');
          return;
        }

        officer = updated;
        ui.notifications?.info(`Oficial "${this.currentData.actorName}" actualizado`);
      }

      this.resolvePromise?.(officer);
      this.close();
    } catch (error) {
      console.error('Error al guardar oficial:', error);
      ui.notifications?.error('Error al guardar el oficial');
    }
  }

  async show(): Promise<Officer | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render(true);
    });
  }

  async close(options?: any) {
    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = undefined;
    }
    return super.close(options);
  }
}
