/**
 * Add or Edit Resource Dialog - Create/Edit Resources using DialogV2
 * Reusable dialog component for resource management throughout the module
 */

import type { Resource } from '../types/entities';
import { DOMEventSetup } from '../utils/DOMEventSetup.js';

export interface ResourceDialogData {
  name: string;
  description: string;
  quantity: number;
  image: string;
  organizationId: string;
}

export class AddOrEditResourceDialog {
  constructor() {
    // Constructor
  }

  /**
   * Setup file picker functionality
   */
  private setupFilePicker(existingResource?: Resource): void {
    const filePickerBtn = document.querySelector('.file-picker-btn[data-target="resource-image"]');
    const imageInput = document.getElementById('resource-image') as HTMLInputElement;
    const descriptionTextarea = document.getElementById(
      'resource-description'
    ) as HTMLTextAreaElement;

    if (filePickerBtn && imageInput && !filePickerBtn.hasAttribute('data-initialized')) {
      // Set initial values for edit mode
      if (existingResource?.image) {
        imageInput.value = existingResource.image;
      }

      if (existingResource?.description && descriptionTextarea) {
        descriptionTextarea.value = existingResource.description;
      }

      filePickerBtn.setAttribute('data-initialized', 'true');
      filePickerBtn.addEventListener('click', function (event: Event) {
        event.preventDefault();
        event.stopPropagation();

        const fp = new FilePicker({
          type: 'imagevideo',
          current: imageInput.value || '',
          callback: (path: string) => {
            imageInput.value = path;
            imageInput.dispatchEvent(new Event('change', { bubbles: true }));
          },
        });

        fp.render(true);
      });
    }
  }

  /**
   * Show the dialog in create or edit mode
   */
  public async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    const content = await this.generateContent(mode, organizationId, existingResource);
    const title = mode === 'create' ? 'Nuevo Recurso' : 'Editar Recurso';

    try {
      // Usar la forma oficial de acceder a DialogV2 en Foundry V13
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.error('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, organizationId, existingResource);
      }

      let resourceResult: Resource | null = null;

      // Setup file picker using centralized DOM event setup
      DOMEventSetup.observe(
        '.file-picker-btn[data-target="resource-image"]',
        () => this.setupFilePicker(existingResource),
        5000
      );

      // Setup textarea value after content is rendered
      DOMEventSetup.observe(
        '#resource-description',
        () => {
          const textarea = document.getElementById('resource-description') as HTMLTextAreaElement;
          if (textarea && existingResource?.description) {
            textarea.value = existingResource.description;
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
                    'form.resource-form'
                  ) as HTMLFormElement;
                }

                // Método 3: Buscar en dialog.element
                if (!form && dialog?.element) {
                  form = dialog.element.querySelector('form.resource-form') as HTMLFormElement;
                }

                // Método 4: Fallback - buscar por button hasta encontrar form padre
                if (!form && button) {
                  let parent = button.parentElement;
                  while (parent && !form) {
                    if (parent.tagName === 'FORM' && parent.classList.contains('resource-form')) {
                      form = parent as HTMLFormElement;
                      break;
                    }
                    form = parent.querySelector('form.resource-form') as HTMLFormElement;
                    if (form) break;
                    parent = parent.parentElement;
                  }
                }

                if (!form) {
                  console.error('No se pudo encontrar el formulario del recurso');
                  if (ui?.notifications) {
                    ui.notifications.error('Error: No se pudo encontrar el formulario');
                  }
                  return 'cancel';
                }

                // Extraer datos del formulario
                const formData = new FormData(form);
                const data: ResourceDialogData = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  quantity: parseInt(formData.get('quantity') as string) || 1,
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

                if (data.quantity < 0) {
                  if (ui?.notifications) {
                    ui.notifications.error('La cantidad no puede ser negativa');
                  }
                  return 'cancel';
                }

                if (!data.organizationId?.trim()) {
                  if (ui?.notifications) {
                    ui.notifications.error('ID de organización es obligatorio');
                  }
                  return 'cancel';
                }

                // Crear el objeto Resource
                const resourceData: Partial<Resource> = {
                  id: existingResource?.id,
                  name: data.name.trim(),
                  description: data.description?.trim() || '',
                  quantity: data.quantity,
                  image: data.image?.trim() || '',
                  organizationId: data.organizationId,
                  version: existingResource ? existingResource.version + 1 : 1,
                  createdAt: existingResource?.createdAt,
                  updatedAt: new Date(),
                };

                // Usar DocumentBasedManager para persistir el recurso
                const gm = (window as any).GuardManagement;
                if (!gm?.documentManager) {
                  console.error('DocumentBasedManager not available');
                  if (ui?.notifications) {
                    ui.notifications.error('Sistema no disponible para guardar recursos');
                  }
                  return 'cancel';
                }

                try {
                  if (mode === 'create') {
                    // Crear nuevo recurso
                    const newResource = await gm.documentManager.createGuardResource(resourceData);
                    resourceResult = {
                      id: newResource.id,
                      name: data.name.trim(),
                      description: data.description?.trim() || '',
                      quantity: data.quantity,
                      image: data.image?.trim() || '',
                      organizationId: data.organizationId,
                      version: 1,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    };
                  } else {
                    // Actualizar recurso existente
                    const updateSuccess = await gm.documentManager.updateGuardResource(
                      existingResource!.id,
                      resourceData
                    );

                    if (updateSuccess) {
                      resourceResult = {
                        id: existingResource!.id,
                        name: data.name.trim(),
                        description: data.description?.trim() || '',
                        quantity: data.quantity,
                        image: data.image?.trim() || '',
                        organizationId: data.organizationId,
                        version: existingResource!.version + 1,
                        createdAt: existingResource!.createdAt || new Date(),
                        updatedAt: new Date(),
                      };
                    } else {
                      if (ui?.notifications) {
                        ui.notifications.error('Error al actualizar el recurso');
                      }
                      return 'cancel';
                    }
                  }
                } catch (error) {
                  console.error('Error al guardar recurso:', error);
                  if (ui?.notifications) {
                    ui.notifications.error('Error al guardar el recurso');
                  }
                  return 'cancel';
                }

                return 'save';
              } catch (error) {
                console.error('Error en el callback del diálogo de recurso:', error);
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

      // Si el resultado es 'save', devolver el resource creado
      if (result === 'save') {
        return resourceResult;
      }

      return null;
    } catch (error) {
      console.error('Error mostrando el diálogo de recurso:', error);
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
    organizationId: string,
    existingResource?: Resource
  ): Promise<string> {
    const data = {
      name: existingResource?.name || '',
      description: existingResource?.description || '',
      quantity: existingResource?.quantity || 1,
      image: existingResource?.image || '',
      organizationId: organizationId,
      isCreate: mode === 'create',
    };

    return renderTemplate('modules/guard-management/templates/dialogs/add-edit-resource.hbs', data);
  }

  /**
   * Fallback method using standard Dialog if DialogV2 is not available
   */
  private async showWithStandardDialog(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    const content = await this.generateContent(mode, organizationId, existingResource);
    const title = mode === 'create' ? 'Nuevo Recurso' : 'Editar Recurso';

    return new Promise((resolve) => {
      new Dialog({
        title,
        content,
        buttons: {
          save: {
            icon: '<i class="fas fa-save"></i>',
            label: mode === 'create' ? 'Crear' : 'Guardar',
            callback: (html: JQuery) => {
              try {
                const form = html.find('form.resource-form')[0] as HTMLFormElement;
                if (!form) {
                  if (ui?.notifications) {
                    ui.notifications.error('Error: No se pudo encontrar el formulario');
                  }
                  resolve(null);
                  return;
                }

                const formData = new FormData(form);
                const data: ResourceDialogData = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  quantity: parseInt(formData.get('quantity') as string) || 1,
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

                if (data.quantity < 0) {
                  if (ui?.notifications) {
                    ui.notifications.error('La cantidad no puede ser negativa');
                  }
                  resolve(null);
                  return;
                }

                if (!data.organizationId?.trim()) {
                  if (ui?.notifications) {
                    ui.notifications.error('ID de organización es obligatorio');
                  }
                  resolve(null);
                  return;
                }

                const resource: Resource = {
                  id: existingResource?.id || foundry.utils.randomID(),
                  name: data.name.trim(),
                  description: data.description?.trim() || '',
                  quantity: data.quantity,
                  organizationId: data.organizationId,
                  version: existingResource ? existingResource.version + 1 : 1,
                  createdAt: existingResource?.createdAt || new Date(),
                  updatedAt: new Date(),
                };

                resolve(resource);
              } catch (error) {
                console.error('Error en el callback del diálogo estándar:', error);
                if (ui?.notifications) {
                  ui.notifications.error('Error al procesar el formulario');
                }
                resolve(null);
              }
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancelar',
            callback: () => resolve(null),
          },
        },
        default: 'save',
        close: () => resolve(null),
      }).render(true);
    });
  }

  /**
   * Static method for quick access to show the dialog
   */
  public static async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    const dialog = new AddOrEditResourceDialog();
    return dialog.show(mode, organizationId, existingResource);
  }

  /**
   * Static method for creating a new resource
   */
  public static async create(organizationId: string): Promise<Resource | null> {
    return this.show('create', organizationId);
  }

  /**
   * Static method for editing an existing resource
   */
  public static async edit(resource: Resource): Promise<Resource | null> {
    return this.show('edit', resource.organizationId, resource);
  }
}
