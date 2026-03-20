// @ts-nocheck
/**
 * OfficerFormApplication
 * Custom FormApplication for creating/editing officers with proper validation
 */

import type { Officer, OfficerSkill, OfficerTrait } from '../types/officer';

interface OfficerFormData {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  skills: OfficerSkill[];
  pros: OfficerTrait[];
  cons: OfficerTrait[];
  organizationId: string;
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
      skills: existingOfficer?.skills ? [...existingOfficer.skills] : [],
      pros: existingOfficer?.pros || [],
      cons: existingOfficer?.cons || [],
      organizationId: existingOfficer?.organizationId || organizationId,
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

    // Setup actor drop zone
    this.setupActorDropZone(html);

    // Setup officer skills (multiple)
    this.setupSkillButtons(html);
    this.setupSkillRemoveButtons(html);

    // Setup trait buttons
    this.setupTraitButtons(html);
    this.setupTraitRemoveButtons(html);

    // Cancel button
    html.find('.cancel-button').on('click', () => {
      this.resolvePromise?.(null);
      this.close();
    });
  }

  private setupActorDropZone(html: JQuery) {
    const dropZone = html.find('.officer-actor-dropzone')[0];
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
      </div>
    `;

    let resolvedName = '';
    let resolvedImage = '';
    let resolvedHopeCost = 0;

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
            const hopeCostInput = dialog.element?.querySelector('#skill-hope-cost') as HTMLInputElement;

            const name = nameInput?.value?.trim();
            if (!name) {
              ui.notifications?.error('El nombre de la habilidad es obligatorio');
              return false;
            }

            resolvedName = name;
            resolvedImage = imageInput?.value?.trim() || '';
            resolvedHopeCost = Math.min(5, Math.max(0, parseInt(hopeCostInput?.value || '0', 10) || 0));
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
        image: resolvedImage || undefined,
        hopeCost: resolvedHopeCost,
      };
      this.currentData.skills = [...(this.currentData.skills || []), newSkill];
      this.render(false);
    }
  }

  private removeSkill(skillId: string) {
    this.currentData.skills = (this.currentData.skills || []).filter((s) => s.id !== skillId);
    this.render(false);
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
            const descInput = dialog.element?.querySelector('#trait-description') as HTMLTextAreaElement;

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
      this.render(false);
    }
  }

  private removeTrait(type: 'pro' | 'con', traitId: string) {
    if (type === 'pro') {
      this.currentData.pros = (this.currentData.pros || []).filter((p) => p.id !== traitId);
    } else {
      this.currentData.cons = (this.currentData.cons || []).filter((c) => c.id !== traitId);
    }
    this.render(false);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async _updateObject(_event: Event, formData: any) {
    if (!this.currentData.actorId?.trim()) {
      ui.notifications?.error('Debes asignar un Actor al oficial');
      return;
    }

    if (!formData.title?.trim()) {
      ui.notifications?.error('El título es obligatorio');
      return;
    }

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
          skills: (this.currentData.skills || []).map((s) => ({
            name: s.name,
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
        });

        ui.notifications?.info(`Oficial "${this.currentData.actorName}" creado`);
      } else {
        const updated = gm.officerManager.update(this.existingOfficer!.id, {
          title: formData.title.trim(),
          skills: this.currentData.skills || [],
          pros: this.currentData.pros,
          cons: this.currentData.cons,
          organizationId: this.currentData.organizationId,
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
