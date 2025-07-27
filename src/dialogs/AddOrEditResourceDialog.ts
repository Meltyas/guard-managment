/**
 * Add or Edit Resource Dialog - Create/Edit Resources using DialogV2
 * Reusable dialog component for resource management throughout the module
 */

import { html } from 'lit-html';
import type { Resource } from '../types/entities';
import { DOMEventSetup } from '../utils/DOMEventSetup.js';
import { renderTemplateToString } from '../utils/template-renderer.js';

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
      console.log('Setting up file picker');

      // Set initial values for edit mode
      if (existingResource?.image) {
        imageInput.value = existingResource.image;
      }

      if (existingResource?.description && descriptionTextarea) {
        descriptionTextarea.value = existingResource.description;
      }

      filePickerBtn.setAttribute('data-initialized', 'true');
      filePickerBtn.addEventListener('click', function (event: Event) {
        console.log('File picker button clicked');
        event.preventDefault();
        event.stopPropagation();

        const fp = new FilePicker({
          type: 'imagevideo',
          current: imageInput.value || '',
          callback: (path: string) => {
            console.log('File selected:', path);
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
    const content = this.generateContent(mode, organizationId, existingResource);
    const title = mode === 'create' ? 'Nuevo Recurso' : 'Editar Recurso';

    try {
      // Usar la forma oficial de acceder a DialogV2 en Foundry V13
      const DialogV2Class = foundry.applications.api.DialogV2;

      if (!DialogV2Class) {
        console.warn('DialogV2 no está disponible, usando Dialog estándar como fallback');
        return this.showWithStandardDialog(mode, organizationId, existingResource);
      }

      let resourceResult: Resource | null = null;

      // Setup file picker using centralized DOM event setup
      DOMEventSetup.observe(
        '.file-picker-btn[data-target="resource-image"]',
        () => this.setupFilePicker(existingResource),
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
            callback: (event: Event, button: any, dialog: any) => {
              try {
                console.log('Resource Dialog callback triggered', { dialog, event, button });

                // En DialogV2, acceder al formulario usando button.form (método oficial)
                let form: HTMLFormElement | null = null;

                // Método 1: Usar button.form (recomendado por la documentación)
                if (button?.form) {
                  form = button.form as HTMLFormElement;
                  console.log('Método 1 - Usando button.form:', { form });
                }

                // Método 2: Buscar en dialog.window.content (accessor oficial)
                if (!form && dialog?.window?.content) {
                  form = dialog.window.content.querySelector(
                    'form.resource-form'
                  ) as HTMLFormElement;
                  console.log('Método 2 - En dialog.window.content:', {
                    content: dialog.window.content,
                    form,
                  });
                }

                // Método 3: Buscar en dialog.element
                if (!form && dialog?.element) {
                  form = dialog.element.querySelector('form.resource-form') as HTMLFormElement;
                  console.log('Método 3 - En dialog.element:', { element: dialog.element, form });
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
                  console.log('Método 4 - Navegando desde button:', { button, form });
                }

                if (!form) {
                  console.error('No se pudo encontrar el formulario del recurso');
                  console.log('Debug completo:', {
                    'button existe': !!button,
                    'button.form existe': !!button?.form,
                    'dialog.window existe': !!dialog?.window,
                    'dialog.window.content existe': !!dialog?.window?.content,
                    'dialog.element existe': !!dialog?.element,
                    'event.target': event.target,
                    'Todos los forms en documento': document.querySelectorAll('form'),
                    'Forms con clase resource-form':
                      document.querySelectorAll('form.resource-form'),
                    'Dialog object completo': dialog,
                    'Button object completo': button,
                  });

                  // Intentar obtener el HTML completo de diferentes elementos para debug
                  if (dialog?.window?.content) {
                    console.log(
                      'Contenido de dialog.window.content:',
                      dialog.window.content.innerHTML.substring(0, 500)
                    );
                  }
                  if (dialog?.element) {
                    console.log(
                      'Contenido del dialog.element:',
                      dialog.element.innerHTML.substring(0, 500)
                    );
                  }

                  if (ui?.notifications) {
                    ui.notifications.error('Error: No se pudo encontrar el formulario');
                  }
                  return 'cancel';
                }

                console.log('Formulario encontrado:', form);

                // Extraer datos del formulario
                const formData = new FormData(form);
                const data: ResourceDialogData = {
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  quantity: parseInt(formData.get('quantity') as string) || 1,
                  image: formData.get('image') as string,
                  organizationId: formData.get('organizationId') as string,
                };

                console.log('Datos del formulario extraídos:', data);

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
                resourceResult = {
                  id: existingResource?.id || foundry.utils.randomID(),
                  name: data.name.trim(),
                  description: data.description?.trim() || '',
                  quantity: data.quantity,
                  image: data.image?.trim() || '',
                  organizationId: data.organizationId,
                  version: existingResource ? existingResource.version + 1 : 1,
                  createdAt: existingResource?.createdAt || new Date(),
                  updatedAt: new Date(),
                };

                console.log('Recurso creado/editado:', resourceResult);

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
  private generateContent(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): string {
    const data: ResourceDialogData = {
      name: existingResource?.name || '',
      description: existingResource?.description || '',
      quantity: existingResource?.quantity || 1,
      image: existingResource?.image || '',
      organizationId: organizationId,
    };

    const template = html`
      <form class="resource-form guard-dialog">
        <div class="form-group">
          <label for="resource-name">Nombre del Recurso</label>
          <input
            type="text"
            id="resource-name"
            name="name"
            value="${data.name}"
            placeholder="Nombre del recurso..."
            required
            maxlength="100"
          />
          <small class="form-hint">Máximo 100 caracteres</small>
        </div>

        <div class="form-group">
          <label for="resource-description">Descripción</label>
          <textarea
            id="resource-description"
            name="description"
            placeholder="Descripción del recurso..."
            rows="3"
            maxlength="500"
          >
${data.description}</textarea
          >
          <small class="form-hint">Opcional. Máximo 500 caracteres</small>
        </div>

        <div class="form-group">
          <label for="resource-image">Imagen</label>
          <div class="file-picker-wrapper">
            <input
              type="text"
              id="resource-image"
              name="image"
              value="${data.image}"
              placeholder="Selecciona una imagen..."
            />
            <button
              type="button"
              class="file-picker-btn"
              data-type="imagevideo"
              data-target="resource-image"
              title="Seleccionar imagen"
            >
              <i class="fas fa-file-image"></i>
            </button>
          </div>
          <small class="form-hint"
            >Opcional. Haz click en el botón para seleccionar una imagen</small
          >
        </div>

        <div class="form-group">
          <label for="resource-quantity">Cantidad</label>
          <input
            type="number"
            id="resource-quantity"
            name="quantity"
            value="${data.quantity}"
            min="0"
            max="999999"
            required
          />
          <small class="form-hint">Cantidad disponible del recurso</small>
        </div>

        <!-- Hidden field for organization ID -->
        <input type="hidden" name="organizationId" value="${data.organizationId}" />

        <div class="form-notes">
          <p>
            <i class="fas fa-info-circle"></i> ${mode === 'create'
              ? 'Se creará un nuevo recurso asociado a la organización.'
              : 'Se actualizará el recurso existente.'}
          </p>
        </div>
      </form>
    `;

    return renderTemplateToString(template);
  }

  /**
   * Fallback method using standard Dialog if DialogV2 is not available
   */
  private async showWithStandardDialog(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    const content = this.generateContent(mode, organizationId, existingResource);
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
