/**
 * AddOrEditOfficerDialog
 * Dialog for creating and editing patrol officers
 */

import type { Officer, OfficerTrait, PatrolSkill } from '../types/officer';
import { OfficerFormApplication } from './OfficerFormApplication';

export interface OfficerDialogData {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  patrolSkills: PatrolSkill[];
  pros: OfficerTrait[];
  cons: OfficerTrait[];
  organizationId?: string;
}

export class AddOrEditOfficerDialog {
  private currentData: Partial<OfficerDialogData> = {
    patrolSkills: [],
    pros: [],
    cons: [],
  };
  private dialogElement: HTMLElement | null = null;
  private dialogId: string = '';

  constructor() {
    this.dialogId = `officer-dialog-${foundry.utils.randomID()}`;
  }

  /**
   * Show officer dialog using FormApplication (recommended - keeps dialog open on validation errors)
   */
  public async showForm(
    mode: 'create' | 'edit',
    organizationId: string,
    existingOfficer?: Officer
  ): Promise<Officer | null> {
    const form = new OfficerFormApplication(mode, organizationId, existingOfficer);
    return form.show();
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    organizationId?: string,
    existingOfficer?: Officer
  ): Promise<Officer | null> {
    // Initialize current data
    if (existingOfficer) {
      this.currentData = {
        actorId: existingOfficer.actorId,
        actorName: existingOfficer.actorName,
        actorImg: existingOfficer.actorImg,
        title: existingOfficer.title,
        patrolSkills: [...existingOfficer.patrolSkills],
        pros: [...existingOfficer.pros],
        cons: [...existingOfficer.cons],
        organizationId: existingOfficer.organizationId,
      };
    } else {
      this.currentData = {
        actorId: '',
        actorName: '',
        actorImg: '',
        title: '',
        patrolSkills: [],
        pros: [],
        cons: [],
        organizationId: organizationId,
      };
    }

    const content = await this.generateContent(mode, organizationId, existingOfficer);
    console.log('Content generado, buscando data-dialog-id en el HTML...');
    console.log('dialogId esperado:', this.dialogId);
    console.log('HTML contiene data-dialog-id?', content.includes('data-dialog-id'));
    console.log('Primeros 500 caracteres del content:', content.substring(0, 500));

    const title = mode === 'create' ? 'Nuevo Oficial' : 'Editar Oficial';

    try {
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.error('DialogV2 no está disponible');
        if (ui?.notifications) {
          ui.notifications.error('DialogV2 no disponible');
        }
        return null;
      }

      let officerResult: Officer | null = null;

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: true,
        },
        content,
        render: (event: any, html: HTMLElement) => {
          // Setup all event listeners when dialog is rendered
          console.log('Dialog rendered, setting up event listeners');
          console.log('DialogId:', this.dialogId);

          // Longer delay to ensure DOM is fully ready
          setTimeout(() => {
            console.log('Running setup methods...');
            this.setupActorDropZone();
            this.setupSkillButtons();
            this.setupSkillRemoveButtons();
            this.setupTraitButtons();
            this.setupTraitRemoveButtons();
          }, 100);
        },
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (event: any, button: any, dialog: any) => {
              let form: HTMLFormElement | null = null;

              // Try multiple methods to find the form
              if (event?.target) {
                form = event.target.closest('form.officer-form') as HTMLFormElement;
              }

              if (!form && button?.form) {
                form = button.form;
              }

              if (!form && dialog?.element) {
                form = dialog.element.querySelector('form.officer-form') as HTMLFormElement;
              }

              if (!form) {
                console.error('No se pudo encontrar el formulario del oficial');
                if (ui?.notifications) {
                  ui.notifications.error('Error: No se pudo encontrar el formulario');
                }
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                return false;
              }

              // Extract data from form
              const formData = new FormData(form);
              const data: OfficerDialogData = {
                actorId: this.currentData.actorId || '',
                actorName: this.currentData.actorName || '',
                actorImg: this.currentData.actorImg || '',
                title: (formData.get('title') as string) || '',
                patrolSkills: this.currentData.patrolSkills || [],
                pros: this.currentData.pros || [],
                cons: this.currentData.cons || [],
                organizationId: (formData.get('organizationId') as string) || organizationId,
              };

              // Validation
              if (!data.actorId?.trim()) {
                if (ui?.notifications) {
                  ui.notifications.error('Debes asignar un Actor al oficial');
                }
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                return false;
              }

              if (!data.title?.trim()) {
                if (ui?.notifications) {
                  ui.notifications.error('El título es obligatorio');
                }
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                return false;
              }

              // Get OfficerManager
              const gm = (window as any).GuardManagement;
              if (!gm?.officerManager) {
                console.error('OfficerManager not available');
                if (ui?.notifications) {
                  ui.notifications.error('Sistema de oficiales no disponible');
                }
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                return false;
              }

              try {
                if (mode === 'create') {
                  // Create new officer
                  officerResult = gm.officerManager.create({
                    actorId: data.actorId,
                    actorName: data.actorName,
                    actorImg: data.actorImg,
                    title: data.title.trim(),
                    patrolSkills: data.patrolSkills.map((s: PatrolSkill) => ({
                      title: s.title,
                      description: s.description,
                      hopeCost: s.hopeCost,
                    })),
                    pros: data.pros.map((p: OfficerTrait) => ({
                      title: p.title,
                      description: p.description,
                    })),
                    cons: data.cons.map((c: OfficerTrait) => ({
                      title: c.title,
                      description: c.description,
                    })),
                    organizationId: data.organizationId,
                  });

                  if (ui?.notifications) {
                    ui.notifications.info(`Oficial "${data.actorName}" creado`);
                  }
                } else {
                  // Update existing officer
                  officerResult = gm.officerManager.update(existingOfficer!.id, {
                    title: data.title.trim(),
                    patrolSkills: data.patrolSkills,
                    pros: data.pros,
                    cons: data.cons,
                    organizationId: data.organizationId,
                  });

                  if (officerResult && ui?.notifications) {
                    ui.notifications.info(`Oficial "${data.actorName}" actualizado`);
                  }
                }
              } catch (error) {
                console.error('Error al guardar oficial:', error);
                if (ui?.notifications) {
                  ui.notifications.error('Error al guardar el oficial');
                }
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                return false;
              }

              return officerResult ? 'save' : false;
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'Cancelar',
          },
        ],
        rejectClose: false,
        modal: false,
      });

      if (result === 'save') {
        return officerResult;
      }

      return null;
    } catch (error) {
      console.error('Error mostrando el diálogo de oficial:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al mostrar el diálogo');
      }
      return null;
    }
  }

  /**
   * Generate the HTML content for the dialog
   */
  private async generateContent(
    mode: 'create' | 'edit',
    organizationId?: string,
    existingOfficer?: Officer
  ): Promise<string> {
    const data = {
      dialogId: this.dialogId,
      actorId: this.currentData.actorId || '',
      actorName: this.currentData.actorName || '',
      actorImg: this.currentData.actorImg || '',
      title: this.currentData.title || '',
      patrolSkills: this.currentData.patrolSkills || [],
      pros: this.currentData.pros || [],
      cons: this.currentData.cons || [],
      organizationId: organizationId || '',
      isCreate: mode === 'create',
    };

    return renderTemplate('modules/guard-management/templates/dialogs/add-edit-officer.hbs', data);
  }

  /**
   * Setup actor drop zone for drag & drop
   */
  private setupActorDropZone(): void {
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;
    if (!container) {
      console.warn('setupActorDropZone: No se encontró el contenedor con dialogId:', this.dialogId);
      return;
    }

    const dropZone = container.querySelector('.officer-actor-dropzone') as HTMLElement;
    if (!dropZone) {
      console.log('setupActorDropZone: No hay dropzone (puede ser que ya haya un actor asignado)');
      return;
    }

    console.log('setupActorDropZone: Configurando dropzone para dialogId:', this.dialogId);

    // Remove old listeners by cloning the element
    const newDropZone = dropZone.cloneNode(true) as HTMLElement;
    dropZone.parentNode?.replaceChild(newDropZone, dropZone);

    newDropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      newDropZone.classList.add('drag-over');
    });

    newDropZone.addEventListener('dragleave', () => {
      newDropZone.classList.remove('drag-over');
    });

    newDropZone.addEventListener('drop', async (event) => {
      event.preventDefault();
      newDropZone.classList.remove('drag-over');

      console.log('Drop event detected!');

      try {
        const data = JSON.parse(event.dataTransfer?.getData('text/plain') || '{}');
        console.log('Drop data:', data);

        if (data.type === 'Actor') {
          const actor = await fromUuid(data.uuid);
          if (actor) {
            console.log('Actor found:', actor.name);
            this.currentData.actorId = actor.id;
            this.currentData.actorName = actor.name || '';
            this.currentData.actorImg = actor.img || '';

            // Re-render the dialog content
            await this.refreshContent();

            if (ui?.notifications) {
              ui.notifications.info(`Actor "${actor.name}" asignado`);
            }
          }
        }
      } catch (error) {
        console.error('Error en drop de actor:', error);
      }
    });
  }

  /**
   * Setup trait add buttons
   */
  private setupTraitButtons(): void {
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;
    if (!container) {
      console.warn('setupTraitButtons: No se encontró el contenedor con dialogId:', this.dialogId);
      return;
    }

    const addButtons = container.querySelectorAll('.add-trait-btn');
    console.log(
      'setupTraitButtons: Encontrados',
      addButtons.length,
      'botones para dialogId:',
      this.dialogId
    );

    addButtons.forEach((button) => {
      const newButton = button.cloneNode(true) as HTMLElement;
      button.parentNode?.replaceChild(newButton, button);

      newButton.addEventListener('click', async (event) => {
        event.preventDefault();
        console.log('Add trait button clicked, type:', newButton.dataset.traitType);
        const traitType = newButton.dataset.traitType as 'pro' | 'con';
        await this.showAddTraitDialog(traitType);
      });
    });
  }

  /**
   * Setup skill add button
   */
  private setupSkillButtons(): void {
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;
    if (!container) return;

    const addButton = container.querySelector('.add-skill-btn');
    if (!addButton) return;

    const newButton = addButton.cloneNode(true) as HTMLElement;
    addButton.parentNode?.replaceChild(newButton, addButton);

    newButton.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.showAddSkillDialog();
    });
  }

  /**
   * Setup skill remove buttons
   */
  private setupSkillRemoveButtons(): void {
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;
    if (!container) return;

    const removeButtons = container.querySelectorAll('.skill-remove-btn');
    removeButtons.forEach((button) => {
      const newButton = button.cloneNode(true) as HTMLElement;
      button.parentNode?.replaceChild(newButton, button);

      newButton.addEventListener('click', (event) => {
        event.preventDefault();
        const skillId = newButton.dataset.skillId;
        this.removeSkill(skillId!);
      });
    });
  }

  /**
   * Setup trait remove buttons
   */
  private setupTraitRemoveButtons(): void {
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;
    if (!container) return;

    const removeButtons = container.querySelectorAll('.trait-remove-btn');
    removeButtons.forEach((button) => {
      const newButton = button.cloneNode(true) as HTMLElement;
      button.parentNode?.replaceChild(newButton, button);

      newButton.addEventListener('click', (event) => {
        event.preventDefault();
        const traitId = newButton.dataset.traitId;
        const traitType = newButton.dataset.traitType as 'pro' | 'con';
        this.removeTrait(traitId!, traitType);
      });
    });
  }

  /**
   * Show dialog to add a trait
   */
  private async showAddTraitDialog(traitType: 'pro' | 'con'): Promise<void> {
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-trait.hbs',
      { title: '', description: '' }
    );

    // Setup editor buttons after dialog opens
    setTimeout(() => {
      const toolbar = document.querySelector('.editor-toolbar');
      if (toolbar) {
        toolbar.addEventListener('click', (e) => {
          const button = (e.target as HTMLElement).closest('.editor-btn');
          if (!button) return;

          e.preventDefault();
          const action = button.getAttribute('data-action');
          if (action) {
            document.execCommand(action, false);
            document.querySelector('.editor-content')?.focus();
          }
        });
      }
    }, 150);

    const result = await DialogV2Class.wait({
      window: {
        title: traitType === 'pro' ? 'Agregar Pro' : 'Agregar Con',
        resizable: true,
      },
      content,
      buttons: [
        {
          action: 'add',
          icon: 'fas fa-plus',
          label: 'Agregar',
          callback: (event: any, button: any, dialog: any) => {
            // Get data from inputs including rich text editor
            const dialogElement = dialog.element || dialog.window?.element;
            if (!dialogElement) {
              console.error('❌ No se pudo encontrar el elemento del diálogo');
              return 'cancel';
            }

            const titleInput = dialogElement.querySelector('#trait-title') as HTMLInputElement;
            const editorContent = dialogElement.querySelector('#trait-description') as HTMLElement;

            const title = titleInput?.value?.trim() || '';
            // Obtener el contenido HTML del editor
            const description = editorContent?.innerHTML?.trim() || '';

            if (!title) {
              if (ui?.notifications) {
                ui.notifications.error('El título es obligatorio');
              }
              return 'cancel';
            }

            if (!description) {
              if (ui?.notifications) {
                ui.notifications.error('La descripción es obligatoria');
              }
              return 'cancel';
            }

            const newTrait: OfficerTrait = {
              id: foundry.utils.randomID(),
              title: title.trim(),
              description: description.trim(),
              createdAt: new Date(),
            };

            if (traitType === 'pro') {
              this.currentData.pros = [...(this.currentData.pros || []), newTrait];
            } else {
              this.currentData.cons = [...(this.currentData.cons || []), newTrait];
            }

            console.log('✅ Trait agregado:', newTrait.title);
            console.log('Total pros:', this.currentData.pros?.length || 0);
            console.log('Total cons:', this.currentData.cons?.length || 0);

            this.refreshContent();

            if (ui?.notifications) {
              ui.notifications.info(`${traitType === 'pro' ? 'Pro' : 'Con'} "${title}" agregado`);
            }

            return 'add';
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'Cancelar',
        },
      ],
      rejectClose: false,
      modal: false,
    });
  }

  /**
   * Remove a trait
   */
  private removeTrait(traitId: string, traitType: 'pro' | 'con'): void {
    if (traitType === 'pro') {
      this.currentData.pros = (this.currentData.pros || []).filter((p) => p.id !== traitId);
    } else {
      this.currentData.cons = (this.currentData.cons || []).filter((c) => c.id !== traitId);
    }

    this.refreshContent();
  }

  /**
   * Show dialog to add a patrol skill
   */
  private async showAddSkillDialog(): Promise<void> {
    const DialogV2Class = foundry.applications.api.DialogV2;
    if (!DialogV2Class) return;

    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-skill.hbs',
      { title: '', description: '', hopeCost: 0 }
    );

    // Setup editor buttons after dialog opens
    setTimeout(() => {
      const toolbar = document.querySelector('.editor-toolbar');
      if (toolbar) {
        toolbar.addEventListener('click', (e) => {
          const button = (e.target as HTMLElement).closest('.editor-btn');
          if (!button) return;

          e.preventDefault();
          const action = button.getAttribute('data-action');
          if (action) {
            document.execCommand(action, false);
            document.querySelector('.editor-content')?.focus();
          }
        });
      }
    }, 150);

    const result = await DialogV2Class.wait({
      window: {
        title: 'Agregar Patrol Skill',
        resizable: true,
      },
      content,
      buttons: [
        {
          action: 'add',
          icon: 'fas fa-plus',
          label: 'Agregar',
          callback: (event: any, button: any, dialog: any) => {
            // Get data from inputs including rich text editor
            const dialogElement = dialog.element || dialog.window?.element;
            if (!dialogElement) {
              console.error('❌ No se pudo encontrar el elemento del diálogo');
              return 'cancel';
            }

            const titleInput = dialogElement.querySelector('#skill-title') as HTMLInputElement;
            const hopeCostInput = dialogElement.querySelector(
              '#skill-hope-cost'
            ) as HTMLInputElement;
            const editorContent = dialogElement.querySelector('#skill-description') as HTMLElement;

            const title = titleInput?.value?.trim() || '';
            const hopeCost = parseInt(hopeCostInput?.value || '0');
            const description = editorContent?.innerHTML?.trim() || '';

            if (!title) {
              if (ui?.notifications) {
                ui.notifications.error('El título es obligatorio');
              }
              return 'cancel';
            }

            if (!description) {
              if (ui?.notifications) {
                ui.notifications.error('La descripción es obligatoria');
              }
              return 'cancel';
            }

            if (hopeCost < 0 || hopeCost > 5) {
              if (ui?.notifications) {
                ui.notifications.error('El coste de Hope debe estar entre 0 y 5');
              }
              return 'cancel';
            }

            const newSkill: PatrolSkill = {
              id: foundry.utils.randomID(),
              title: title.trim(),
              description: description.trim(),
              hopeCost,
              createdAt: new Date(),
            };

            this.currentData.patrolSkills = [...(this.currentData.patrolSkills || []), newSkill];

            this.refreshContent();

            if (ui?.notifications) {
              ui.notifications.info(`Skill "${title}" agregada`);
            }

            return 'add';
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'Cancelar',
        },
      ],
      rejectClose: false,
      modal: false,
    });
  }

  /**
   * Remove a patrol skill
   */
  private removeSkill(skillId: string): void {
    this.currentData.patrolSkills = (this.currentData.patrolSkills || []).filter(
      (s) => s.id !== skillId
    );
    this.refreshContent();
  }

  /**
   * Refresh dialog content
   */
  private async refreshContent(): Promise<void> {
    // Find THIS specific dialog using the unique dialogId
    const container = document.querySelector(
      `.officer-content[data-dialog-id="${this.dialogId}"]`
    ) as HTMLElement;

    if (!container) {
      console.warn('No se pudo encontrar el contenedor del oficial para refrescar');
      return;
    }

    const dialogElement = container.closest('dialog.application.dialog') as HTMLElement;
    if (!dialogElement) {
      console.warn('No se pudo encontrar el dialog del oficial');
      return;
    }

    // Save current form values before refresh
    const titleInput = container.querySelector('input[name="title"]') as HTMLInputElement;
    if (titleInput) {
      this.currentData.title = titleInput.value;
    }

    const content = await renderTemplate(
      'modules/guard-management/templates/dialogs/add-edit-officer.hbs',
      {
        dialogId: this.dialogId,
        actorId: this.currentData.actorId || '',
        actorName: this.currentData.actorName || '',
        actorImg: this.currentData.actorImg || '',
        title: this.currentData.title || '',
        patrolSkills: this.currentData.patrolSkills || [],
        pros: this.currentData.pros || [],
        cons: this.currentData.cons || [],
        organizationId: this.currentData.organizationId || '',
      }
    );

    // Find the dialog-content area that DialogV2 creates
    const dialogContent = dialogElement.querySelector('.dialog-content');

    if (dialogContent) {
      dialogContent.innerHTML = content;

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        // Re-setup event listeners
        this.setupActorDropZone();
        this.setupSkillButtons();
        this.setupSkillRemoveButtons();
        this.setupTraitButtons();
        this.setupTraitRemoveButtons();
      }, 100);
    } else {
      console.warn('No se pudo encontrar el área de contenido del dialog');
    }
  }

  /**
   * Static method for quick access to show the dialog
   */
  public static async show(
    mode: 'create' | 'edit',
    organizationId?: string,
    existingOfficer?: Officer
  ): Promise<Officer | null> {
    const dialog = new AddOrEditOfficerDialog();
    return dialog.showForm(mode, organizationId, existingOfficer);
  }

  /**
   * Static method for creating a new officer
   */
  public static async create(organizationId?: string): Promise<Officer | null> {
    return this.show('create', organizationId);
  }

  /**
   * Static method for editing an existing officer
   */
  public static async edit(officer: Officer): Promise<Officer | null> {
    return this.show('edit', officer.organizationId, officer);
  }
}
