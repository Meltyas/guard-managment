/**
 * Add or Edit Resource Dialog - Create/Edit Resources using GuardModal
 */

import type { Resource } from '../types/entities';
import { GuardModal } from '../ui/GuardModal.js';

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
      return await GuardModal.openAsync<Resource>({
        title,
        icon: 'fas fa-box',
        body: content,
        saveLabel: mode === 'create' ? 'Crear' : 'Guardar',
        onRender: (bodyEl) => {
          const filePickerBtn = bodyEl.querySelector('.file-picker-btn[data-target="resource-image"]');
          const imageInput = bodyEl.querySelector('#resource-image') as HTMLInputElement;

          if (existingResource?.image && imageInput) {
            imageInput.value = existingResource.image;
          }

          if (filePickerBtn && imageInput) {
            filePickerBtn.addEventListener('click', (ev: Event) => {
              ev.preventDefault();
              const fp = new FilePicker({
                type: 'imagevideo' as any,
                current: imageInput.value || '',
                callback: (path: string) => {
                  imageInput.value = path;
                },
              });
              fp.render(true);
            });
          }
        },
        onSave: async (bodyEl) => {
          const form = bodyEl.querySelector('form.guard-modal-form') as HTMLFormElement;
          if (!form) {
            ui?.notifications?.error('No se pudo encontrar el formulario');
            return false;
          }

          const formData = new FormData(form);
          const data: ResourceDialogData = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            quantity: parseInt(formData.get('quantity') as string) || 1,
            image: formData.get('image') as string,
            organizationId: formData.get('organizationId') as string,
          };

          if (!data.name?.trim()) {
            ui?.notifications?.error('El nombre es obligatorio');
            return false;
          }
          if (data.quantity < 0) {
            ui?.notifications?.error('La cantidad no puede ser negativa');
            return false;
          }
          if (!data.organizationId?.trim()) {
            ui?.notifications?.error('ID de organización es obligatorio');
            return false;
          }

          const gm = (window as any).GuardManagement;
          if (!gm?.resourceManager) {
            ui?.notifications?.error('Sistema no disponible para guardar recursos');
            return false;
          }

          if (mode === 'create') {
            const newResource = await gm.resourceManager.createResource({
              name: data.name.trim(),
              description: data.description?.trim() || '',
              quantity: data.quantity,
              image: data.image?.trim() || '',
              organizationId: data.organizationId,
              version: 1,
            });
            return {
              id: newResource.id,
              name: data.name.trim(),
              description: data.description?.trim() || '',
              quantity: data.quantity,
              image: data.image?.trim() || '',
              organizationId: data.organizationId,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Resource;
          } else {
            const updateSuccess = await gm.resourceManager.updateResource(
              existingResource!.id,
              {
                name: data.name.trim(),
                description: data.description?.trim() || '',
                quantity: data.quantity,
                image: data.image?.trim() || '',
                organizationId: data.organizationId,
                version: existingResource!.version + 1,
              }
            );
            if (!updateSuccess) {
              ui?.notifications?.error('Error al actualizar el recurso');
              return false;
            }
            return {
              id: existingResource!.id,
              name: data.name.trim(),
              description: data.description?.trim() || '',
              quantity: data.quantity,
              image: data.image?.trim() || '',
              organizationId: data.organizationId,
              version: existingResource!.version + 1,
              createdAt: existingResource!.createdAt || new Date(),
              updatedAt: new Date(),
            } as Resource;
          }
        },
      });
    } catch (error) {
      console.error('Error mostrando el diálogo de recurso:', error);
      ui?.notifications?.error('Error al mostrar el diálogo');
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

    return foundry.applications.handlebars.renderTemplate('modules/guard-management/templates/dialogs/add-edit-resource.hbs', data);
  }

  public static async show(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    const dialog = new AddOrEditResourceDialog();
    return dialog.show(mode, organizationId, existingResource);
  }

  public static async create(organizationId: string): Promise<Resource | null> {
    return this.show('create', organizationId);
  }

  public static async edit(resource: Resource): Promise<Resource | null> {
    return this.show('edit', resource.organizationId, resource);
  }
}
