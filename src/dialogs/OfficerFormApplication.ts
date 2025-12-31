/**
 * OfficerFormApplication
 * Custom FormApplication for creating/editing officers with proper validation
 */

import type { Officer, OfficerTrait, PatrolSkill } from '../types/officer';

interface OfficerFormData {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  patrolSkills: PatrolSkill[];
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
      patrolSkills: existingOfficer?.patrolSkills || [],
      pros: existingOfficer?.pros || [],
      cons: existingOfficer?.cons || [],
      organizationId: existingOfficer?.organizationId || organizationId,
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['guard-management', 'officer-form-app'],
      template: 'modules/guard-management/templates/dialogs/add-edit-officer.hbs',
      width: 600,
      height: 'auto',
      resizable: true,
      closeOnSubmit: false, // Don't close on submit - we'll handle it manually
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
      ...this.currentData, // Spread officer data at root level
      organizationId: this.organizationId,
    };
  }

  activateListeners(html: JQuery) {
    super.activateListeners(html);

    // Setup actor drop zone
    this.setupActorDropZone(html);

    // Setup skill buttons
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

        // Update current data
        this.currentData.actorId = actor.id;
        this.currentData.actorName = actor.name;
        this.currentData.actorImg = actor.img;

        // Re-render to show updated actor
        this.render(false);
      } catch (error) {
        console.error('Error handling actor drop:', error);
      }
    });
  }

  private setupSkillButtons(html: JQuery) {
    html.find('.add-skill-btn').on('click', async (event) => {
      event.preventDefault();
      await this.showAddSkillDialog();
    });
  }

  private setupSkillRemoveButtons(html: JQuery) {
    html.find('.remove-skill-btn').on('click', (event) => {
      event.preventDefault();
      const skillId = $(event.currentTarget).data('skill-id');
      this.removeSkill(skillId);
    });
  }

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

  private async showAddSkillDialog() {
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-skill.hbs',
      { title: '', description: '', hopeCost: 0 }
    );

    let editorContent = '';

    const result = await DialogV2Class.wait({
      window: { title: 'Agregar Patrol Skill' },
      content,
      buttons: [
        {
          action: 'add',
          icon: 'fas fa-plus',
          label: 'Agregar',
          callback: (event: any, button: any, dialog: any) => {
            const titleInput = dialog.element?.querySelector('#skill-title') as HTMLInputElement;
            const hopeCostInput = dialog.element?.querySelector(
              '#skill-hope-cost'
            ) as HTMLInputElement;
            const editor = dialog.element?.querySelector('.editor-content') as HTMLElement;

            const title = titleInput?.value?.trim();
            const hopeCost = parseInt(hopeCostInput?.value || '0');
            editorContent = editor?.innerHTML || '';

            if (!title) {
              ui.notifications?.error('El título es obligatorio');
              return false;
            }

            return 'add';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'add') {
      const titleInput = document.querySelector('#skill-title') as HTMLInputElement;
      const hopeCostInput = document.querySelector('#skill-hope-cost') as HTMLInputElement;

      const newSkill: PatrolSkill = {
        id: foundry.utils.randomID(),
        title: titleInput?.value?.trim() || '',
        description: editorContent,
        hopeCost: parseInt(hopeCostInput?.value || '0'),
        createdAt: new Date(),
      };

      this.currentData.patrolSkills = [...(this.currentData.patrolSkills || []), newSkill];
      this.render(false);
    }
  }

  private removeSkill(skillId: string) {
    this.currentData.patrolSkills = (this.currentData.patrolSkills || []).filter(
      (s) => s.id !== skillId
    );
    this.render(false);
  }

  private async showAddTraitDialog(type: 'pro' | 'con') {
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-trait.hbs',
      { title: '', description: '' }
    );

    let editorContent = '';

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
            const editor = dialog.element?.querySelector('.editor-content') as HTMLElement;

            const title = titleInput?.value?.trim();
            editorContent = editor?.innerHTML || '';

            if (!title) {
              ui.notifications?.error('El título es obligatorio');
              return false;
            }

            return 'add';
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'Cancelar' },
      ],
    });

    if (result === 'add') {
      const titleInput = document.querySelector('#trait-title') as HTMLInputElement;

      const newTrait: OfficerTrait = {
        id: foundry.utils.randomID(),
        title: titleInput?.value?.trim() || '',
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

  async _updateObject(_event: Event, formData: any) {
    // Validate
    if (!this.currentData.actorId?.trim()) {
      ui.notifications?.error('Debes asignar un Actor al oficial');
      return; // Don't close - just return
    }

    if (!formData.title?.trim()) {
      ui.notifications?.error('El título es obligatorio');
      return; // Don't close - just return
    }

    // Get OfficerManager
    const gm = (window as any).GuardManagement;
    if (!gm?.officerManager) {
      console.error('OfficerManager not available');
      ui.notifications?.error('Sistema de oficiales no disponible');
      return;
    }

    try {
      let officer: Officer;

      if (this.mode === 'create') {
        officer = gm.officerManager.create({
          actorId: this.currentData.actorId!,
          actorName: this.currentData.actorName!,
          actorImg: this.currentData.actorImg,
          title: formData.title.trim(),
          patrolSkills: (this.currentData.patrolSkills || []).map((s: PatrolSkill) => ({
            title: s.title,
            description: s.description,
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
          patrolSkills: this.currentData.patrolSkills,
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

      // Success - resolve and close
      this.resolvePromise?.(officer);
      this.close();
    } catch (error) {
      console.error('Error al guardar oficial:', error);
      ui.notifications?.error('Error al guardar el oficial');
      // Don't close on error
    }
  }

  /**
   * Show the form and return a promise
   */
  async show(): Promise<Officer | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render(true);
    });
  }

  async close(options?: any) {
    // If closing without resolving, resolve with null
    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = undefined;
    }
    return super.close(options);
  }
}
