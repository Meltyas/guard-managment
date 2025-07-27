/**
 * Centralized Resource Event Handler
 * Eliminates code duplication across dialogs for resource management
 */

import { AddOrEditResourceDialog } from '../dialogs/AddOrEditResourceDialog.js';

export interface ResourceEventContext {
  organizationId?: string;
  onResourceAdded?: (resource: any) => void;
  onResourceEdited?: (resource: any) => void;
  onResourceRemoved?: (resourceId: string) => void;
  refreshUI?: () => void;
}

export class ResourceEventHandler {
  /**
   * Setup all resource event listeners for a dialog/component
   */
  static setup(context: ResourceEventContext): void {
    // SIMPLE APPROACH: Remove all existing handlers first
    this.removeAllHandlers();

    // Setup add resource buttons
    const addResourceBtns = document.querySelectorAll(
      '.add-resource-btn'
    ) as NodeListOf<HTMLButtonElement>;
    addResourceBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.handleAdd(context);
      });
    });

    // Setup edit resource buttons
    const editResourceBtns = document.querySelectorAll(
      '.edit-resource-btn'
    ) as NodeListOf<HTMLButtonElement>;
    editResourceBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const resourceId = btn.getAttribute('data-resource-id');
        if (resourceId) {
          await this.handleEdit(context, resourceId);
        }
      });
    });

    // Setup remove resource buttons
    const removeResourceBtns = document.querySelectorAll(
      '.remove-resource-btn'
    ) as NodeListOf<HTMLButtonElement>;
    removeResourceBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const resourceId = btn.getAttribute('data-resource-id');
        if (resourceId) {
          await this.handleRemove(context, resourceId);
        }
      });
    });

    // Setup drag and drop
    this.setupDragAndDrop(context);
  }

  /**
   * Force remove all handlers by cloning elements (nuclear option)
   */
  static removeAllHandlers(): void {
    document
      .querySelectorAll('.add-resource-btn, .edit-resource-btn, .remove-resource-btn')
      .forEach((btn) => {
        const clonedBtn = btn.cloneNode(true);
        btn.parentNode?.replaceChild(clonedBtn, btn);
      });
  }

  /**
   * Setup with retry mechanism for DialogV2 compatibility
   */
  static setupWithRetry(context: ResourceEventContext, retries: number = 5): void {
    const attempt = () => {
      const addBtns = document.querySelectorAll('.add-resource-btn');
      const editBtns = document.querySelectorAll('.edit-resource-btn');
      const removeBtns = document.querySelectorAll('.remove-resource-btn');
      const dropZones = document.querySelectorAll('.drop-zone');

      if (
        addBtns.length > 0 ||
        editBtns.length > 0 ||
        removeBtns.length > 0 ||
        dropZones.length > 0
      ) {
        this.setup(context);
      } else if (retries > 0) {
        setTimeout(() => this.setupWithRetry(context, retries - 1), 200);
      } else {
        console.error(
          'ResourceEventHandler | Could not find resource elements after multiple retries'
        );
      }
    };

    attempt();
  }

  /**
   * Handle adding a new resource
   */
  private static async handleAdd(context: ResourceEventContext): Promise<void> {
    try {
      const organizationId = context.organizationId || 'temp-org-id';
      const newResource = await AddOrEditResourceDialog.create(organizationId);

      if (newResource) {
        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${newResource.name}" agregado`);
        }

        context.onResourceAdded?.(newResource);
        context.refreshUI?.();
      }
    } catch (error) {
      console.error('ResourceEventHandler | Error adding resource:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al agregar recurso');
      }
    }
  }

  /**
   * Handle editing an existing resource
   */
  private static async handleEdit(
    context: ResourceEventContext,
    resourceId: string
  ): Promise<void> {
    try {
      // For now, we need to get the resource object from the context or manager
      // This is a limitation - we need the full Resource object, not just the ID
      console.log('ResourceEventHandler | Edit requested for resource ID:', resourceId);

      if (ui?.notifications) {
        ui.notifications.warn(
          'Edición de recursos - funcionalidad pendiente de implementar completamente'
        );
      }

      // TODO: Implement proper resource retrieval by ID
      // const resource = await SomeManager.getResourceById(resourceId);
      // const updatedResource = await AddOrEditResourceDialog.edit(resource);
    } catch (error) {
      console.error('ResourceEventHandler | Error editing resource:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar recurso');
      }
    }
  }

  /**
   * Handle removing a resource
   */
  private static async handleRemove(
    context: ResourceEventContext,
    resourceId: string
  ): Promise<void> {
    try {
      // Simple confirmation dialog
      const confirmed = await Dialog.confirm({
        title: 'Confirmar eliminación',
        content: '<p>¿Estás seguro de que quieres eliminar este recurso?</p>',
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });

      if (confirmed) {
        context.onResourceRemoved?.(resourceId);
        context.refreshUI?.();

        if (ui?.notifications) {
          ui.notifications.info('Recurso eliminado');
        }
      }
    } catch (error) {
      console.error('ResourceEventHandler | Error removing resource:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al eliminar recurso');
      }
    }
  }

  /**
   * Setup drag and drop functionality
   */
  private static setupDragAndDrop(context: ResourceEventContext): void {
    const dropZones = document.querySelectorAll('.drop-zone');

    dropZones.forEach((zone) => {
      const element = zone as HTMLElement;

      element.addEventListener('dragover', (event) => {
        event.preventDefault();
        element.classList.add('drag-over');
      });

      element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
      });

      element.addEventListener('drop', async (event) => {
        event.preventDefault();
        element.classList.remove('drag-over');

        try {
          const data = event.dataTransfer?.getData('text/plain');
          if (data) {
            const draggedData = JSON.parse(data);

            if (draggedData.type === 'resource') {
              context.onResourceAdded?.(draggedData.resource);
              context.refreshUI?.();

              if (ui?.notifications) {
                ui.notifications.info('Recurso agregado');
              }
            }
          }
        } catch (error) {
          console.error('ResourceEventHandler | Error handling drop:', error);
        }
      });
    });
  }

  /**
   * Clean up event listeners (call when dialog closes)
   */
  static cleanup(): void {
    // Remove all our custom attributes so elements can be re-setup
    document.querySelectorAll('[data-resource-handler-setup]').forEach((el) => {
      el.removeAttribute('data-resource-handler-setup');
    });

    document.querySelectorAll('[data-resource-drop-setup]').forEach((el) => {
      el.removeAttribute('data-resource-drop-setup');
    });
  }
}
