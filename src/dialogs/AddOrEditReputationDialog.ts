/**
 * Dialog for adding or editing reputation entries using DialogV2
 * Mirrors the exact pattern used by AddOrEditResourceDialog
 */

import { Reputation, REPUTATION_LABELS, ReputationLevel } from '../types/entities.js';
import { DOMEventSetup } from '../utils/DOMEventSetup.js';

interface ReputationDialogData {
  name: string;
  description: string;
  level: ReputationLevel;
  image: string;
  organizationId: string;
}

export class AddOrEditReputationDialog {
  private filePicker: any;

  constructor() {
    this.filePicker = null;
  }

  /**
   * Clean up any existing event listeners
   */
  private cleanup(): void {
    // Cleanup file picker reference
    this.filePicker = null;
  }

  /**
   * Setup file picker for the reputation image
   */
  private setupFilePicker(existingReputation?: Reputation): void {
    try {
      // Check if the image input exists
      const imageInput = document.getElementById('reputation-image') as HTMLInputElement;
      if (!imageInput) {
        console.warn('Reputation image input not found, delaying file picker setup');
        return;
      }

      // Add click handler to the file picker button
      const filePickerBtn = document.querySelector(
        '.file-picker-btn[data-target="reputation-image"]'
      ) as HTMLElement;

      if (filePickerBtn) {
        filePickerBtn.onclick = () => {
          this.filePicker = new FilePicker({
            type: 'image',
            current: existingReputation?.image || '',
            callback: (path: string) => {
              if (imageInput) {
                imageInput.value = path;
              }
            },
          });
          this.filePicker.browse();
        };
      }
    } catch (error) {
      console.warn('Error setting up file picker for reputation:', error);
    }
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<Reputation | null> {
    const content = await this.generateContent(mode, organizationId, existingReputation);
    const title = mode === 'create' ? 'Nueva Reputación' : 'Editar Reputación';

    try {
      // Usar la forma oficial de acceder a DialogV2 en Foundry V13
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.error('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, organizationId, existingReputation);
      }

      let reputationResult: Reputation | null = null;

      // Setup file picker using centralized DOM event setup
      DOMEventSetup.observe(
        '.file-picker-btn[data-target="reputation-image"]',
        () => this.setupFilePicker(existingReputation),
        5000
      );

      // Setup textarea value after content is rendered
      DOMEventSetup.observe(
        '#reputation-description',
        () => {
          const textarea = document.getElementById('reputation-description') as HTMLTextAreaElement;
          if (textarea && existingReputation?.description) {
            textarea.value = existingReputation.description;
          }
        },
        5000
      );

      const result = await DialogV2Class.wait({
        window: {
          title,
          resizable: true,
        },
        content,
        buttons: [
          {
            action: 'save',
            icon: 'fas fa-save',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            default: true,
            callback: async (_event: Event, button: any, dialog: any) => {
              try {
                // En DialogV2, acceder al formulario usando button.form (método oficial)
                let form: HTMLFormElement | null = null;

                // Método 1: Usar button.form (recomendado por la documentación)
                if (button?.form) {
                  form = button.form as HTMLFormElement;
                }

                // Método 2: Buscar en dialog.window.content (accessor oficial)
                if (!form && dialog?.window?.content) {
                  form = dialog.window.content.querySelector(
                    'form.reputation-form'
                  ) as HTMLFormElement;
                }

                // Método 3: Buscar en dialog.element
                if (!form && dialog?.element) {
                  form = dialog.element.querySelector('form.reputation-form') as HTMLFormElement;
                }

                // Método 4: Fallback - buscar por button hasta encontrar form padre
                if (!form && button) {
                  let parent = button.parentElement;
                  while (parent && !form) {
                    if (parent.tagName === 'FORM' && parent.classList.contains('reputation-form')) {
                      form = parent as HTMLFormElement;
                      break;
                    }
                    form = parent.querySelector('form.reputation-form') as HTMLFormElement;
                    if (form) break;
                    parent = parent.parentElement;
                  }
                }

                if (!form) {
                  console.error('No se pudo encontrar el formulario de reputación');
                  if (ui?.notifications) {
                    ui.notifications.error('Error: No se pudo encontrar el formulario');
                  }
                  return 'cancel';
                }

                // Extraer datos del formulario
                const formData = new FormData(form);
                const data: ReputationDialogData = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  level:
                    (parseInt(formData.get('level') as string) as ReputationLevel) ||
                    ReputationLevel.Neutrales,
                  image: formData.get('image') as string,
                  organizationId: formData.get('organizationId') as string,
                };

                // Validación básica
                if (!data.name?.trim()) {
                  if (ui?.notifications) {
                    ui.notifications.error('El nombre es obligatorio');
                  }
                  return 'cancel';
                }

                if (!data.organizationId?.trim()) {
                  if (ui?.notifications) {
                    ui.notifications.error('ID de organización es obligatorio');
                  }
                  return 'cancel';
                }

                if (!Object.values(ReputationLevel).includes(data.level)) {
                  if (ui?.notifications) {
                    ui.notifications.error('Nivel de reputación inválido');
                  }
                  return 'cancel';
                }

                // Crear el objeto Reputation
                const reputationData: Partial<Reputation> = {
                  id: existingReputation?.id,
                  name: data.name.trim(),
                  description: data.description?.trim() || '',
                  level: data.level,
                  image: data.image?.trim() || '',
                  organizationId: data.organizationId,
                  version: existingReputation ? existingReputation.version + 1 : 1,
                  createdAt: existingReputation?.createdAt,
                  updatedAt: new Date(),
                };

                // Usar DocumentBasedManager para persistir la reputación
                const gm = (window as any).GuardManagement;
                if (!gm?.documentManager) {
                  console.error('DocumentBasedManager not available');
                  if (ui?.notifications) {
                    ui.notifications.error('Sistema no disponible para guardar reputaciones');
                  }
                  return 'cancel';
                }

                try {
                  if (mode === 'create') {
                    // Crear nueva reputación
                    const newReputation =
                      await gm.documentManager.createGuardReputation(reputationData);
                    reputationResult = {
                      id: newReputation.id,
                      name: data.name.trim(),
                      description: data.description?.trim() || '',
                      level: data.level,
                      image: data.image?.trim() || '',
                      organizationId: data.organizationId,
                      version: 1,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  } else {
                    // Actualizar reputación existente
                    const updateSuccess = await gm.documentManager.updateGuardReputation(
                      existingReputation!.id,
                      reputationData
                    );

                    if (updateSuccess) {
                      reputationResult = {
                        id: existingReputation!.id,
                        name: data.name.trim(),
                        description: data.description?.trim() || '',
                        level: data.level,
                        image: data.image?.trim() || '',
                        organizationId: data.organizationId,
                        version: existingReputation!.version + 1,
                        createdAt: existingReputation!.createdAt || new Date(),
                        updatedAt: new Date(),
                      };
                    } else {
                      if (ui?.notifications) {
                        ui.notifications.error('Error al actualizar la reputación');
                      }
                      return 'cancel';
                    }
                  }
                } catch (error) {
                  console.error('Error al guardar reputación:', error);
                  if (ui?.notifications) {
                    ui.notifications.error('Error al guardar la reputación');
                  }
                  return 'cancel';
                }

                return 'save';
              } catch (error) {
                console.error('Error en el callback del diálogo de reputación:', error);
                if (ui?.notifications) {
                  ui.notifications.error('Error al procesar el formulario');
                }
                return 'cancel';
              }
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'Cancelar',
            callback: () => 'cancel',
          },
        ],
      });

      // Si el resultado es 'save', devolver la reputación creada
      if (result === 'save') {
        return reputationResult;
      }

      return null;
    } catch (error) {
      console.error('Error mostrando el diálogo de reputación:', error);
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
    _mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<string> {
    const reputationLevels = Object.entries(REPUTATION_LABELS)
      .map(([value, label]) => ({
        value,
        label,
        selected: existingReputation?.level === parseInt(value)
      }));

    const data = {
      name: existingReputation?.name || '',
      description: existingReputation?.description || '',
      image: existingReputation?.image || '',
      organizationId,
      reputationLevels
    };

    return renderTemplate('modules/guard-management/templates/dialogs/add-edit-reputation.hbs', data);
  }

  /**
   * Fallback for when DialogV2 is not available
   */
  private async showWithStandardDialog(
    mode: 'create' | 'edit',
    organizationId: string,
    existingReputation?: Reputation
  ): Promise<Reputation | null> {
    console.warn('Using standard Dialog fallback for reputation dialog');

    return new Promise(async (resolve) => {
      const content = await this.generateContent(mode, organizationId, existingReputation);

      const dialog = new Dialog({
        title: mode === 'create' ? 'Nueva Reputación' : 'Editar Reputación',
        content,
        buttons: {
          save: {
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: async (html: JQuery) => {
              try {
                const form = html.find('form.reputation-form')[0] as HTMLFormElement;
                if (!form) {
                  if (ui?.notifications) {
                    ui.notifications.error('Error: No se pudo encontrar el formulario');
                  }
                  resolve(null);
                  return;
                }

                const formData = new FormData(form);
                const data: ReputationDialogData = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  level:
                    (parseInt(formData.get('level') as string) as ReputationLevel) ||
                    ReputationLevel.Neutrales,
                  image: formData.get('image') as string,
                  organizationId: formData.get('organizationId') as string,
                };

                // Validación básica
                if (!data.name?.trim()) {
                  if (ui?.notifications) {
                    ui.notifications.error('El nombre es obligatorio');
                  }
                  resolve(null);
                  return;
                }

                // Create reputation object
                const reputationData: Reputation = {
                  id: existingReputation?.id || foundry.utils.randomID(),
                  name: data.name.trim(),
                  description: data.description?.trim() || '',
                  level: data.level,
                  image: data.image?.trim() || '',
                  organizationId: data.organizationId,
                  version: existingReputation ? existingReputation.version + 1 : 1,
                  createdAt: existingReputation?.createdAt || new Date(),
                  updatedAt: new Date(),
                };

                resolve(reputationData);
              } catch (error) {
                console.error('Error in standard dialog callback:', error);
                resolve(null);
              }
            },
          },
          cancel: {
            label: 'Cancelar',
            callback: () => resolve(null),
          },
        },
        default: 'save',
        render: (html: JQuery) => {
          // Setup file picker after render
          setTimeout(() => this.setupFilePicker(existingReputation), 100);

          // Setup textarea value
          const textarea = html.find('#reputation-description')[0] as HTMLTextAreaElement;
          if (textarea && existingReputation?.description) {
            textarea.value = existingReputation.description;
          }
        },
        close: () => {
          this.cleanup();
        },
      });

      dialog.render(true);
    });
  }

  /**
   * Static method for creating a new reputation
   */
  public static async create(organizationId: string): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('create', organizationId);
  }

  /**
   * Static method for editing an existing reputation
   */
  public static async edit(reputation: Reputation): Promise<Reputation | null> {
    const dialog = new AddOrEditReputationDialog();
    return await dialog.show('edit', reputation.organizationId, reputation);
  }

  /**
   * Static method for showing create dialog (for compatibility with event handlers)
   */
  public static async showCreateDialog(organizationId: string): Promise<void> {
    try {
      const result = await AddOrEditReputationDialog.create(organizationId);
      if (result) {
        console.log('Created reputation:', result.name);
        // Trigger organization update
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showCreateDialog:', error);
      ui.notifications?.error('Error creating reputation');
    }
  }

  /**
   * Static method for showing edit dialog (for compatibility with event handlers)
   */
  public static async showEditDialog(reputationId: string): Promise<void> {
    try {
      // Get the reputation data first
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentManager not available');
      }

      const reputations = gm.documentManager.getGuardReputations();
      const reputation = reputations.find((r: any) => r.id === reputationId);

      if (!reputation) {
        throw new Error(`Reputation with ID ${reputationId} not found`);
      }

      // Convert to Reputation interface
      const reputationData: Reputation = {
        id: reputation.id,
        name: reputation.name,
        description: reputation.system?.description || '',
        level: reputation.system?.level || ReputationLevel.Neutrales,
        image: reputation.img || '',
        organizationId: reputation.system?.organizationId || '',
        version: reputation.system?.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await AddOrEditReputationDialog.edit(reputationData);
      if (result) {
        console.log('Updated reputation:', result.name);
        // Trigger organization update
        window.dispatchEvent(new CustomEvent('guard-organizations-updated'));
      }
    } catch (error) {
      console.error('Error in showEditDialog:', error);
      ui.notifications?.error('Error editing reputation');
    }
  }
}
