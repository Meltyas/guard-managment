/**
 * Centralized Resource Event Handler
 * Eliminates code duplication across dialogs for resource management
 */

import { AddOrEditResourceDialog } from '../dialogs/AddOrEditResourceDialog.js';
import { convertFoundryDocumentToResource } from './resource-converter.js';

export interface ResourceEventContext {
  organizationId?: string;
  onResourceAdded?: (resource: any) => void;
  onResourceEdited?: (resource: any) => void;
  onResourceRemoved?: (resourceId: string) => void;
  refreshUI?: () => void;
}

export class ResourceEventHandler {
  private static activeHandlers: Set<HTMLElement> = new Set();
  private static isSetupInProgress: boolean = false;

  /**
   * Setup all resource event listeners for a dialog/component
   */
  static setup(context: ResourceEventContext): void {
    // SIMPLE APPROACH: Remove all existing handlers first
    this.removeAllHandlers();

    // Setup add resource buttons
    const addResourceBtns = document.querySelectorAll('.add-resource-btn') as NodeListOf<HTMLButtonElement>;
    addResourceBtns.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.handleAdd(context);
      });
    });

    // Setup edit resource buttons  
    const editResourceBtns = document.querySelectorAll('.edit-resource-btn') as NodeListOf<HTMLButtonElement>;
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
    const removeResourceBtns = document.querySelectorAll('.remove-resource-btn') as NodeListOf<HTMLButtonElement>;
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
          event.stopPropagation(); // Prevent event bubbling
          const resourceItem = btn.closest('.resource-item') as HTMLElement;
          const resourceId = resourceItem?.dataset.resourceId;
          if (resourceId) {
            await this.handleEdit(resourceId, context);
          }
        });
      }
    });

    // Setup remove resource buttons
    const removeResourceBtns = document.querySelectorAll(
      '.remove-resource-btn'
    ) as NodeListOf<HTMLButtonElement>;
    removeResourceBtns.forEach((btn) => {
      if (!this.activeHandlers.has(btn)) {
        this.activeHandlers.add(btn);
        btn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation(); // Prevent event bubbling
          const resourceItem = btn.closest('.resource-item') as HTMLElement;
          const resourceId = resourceItem?.dataset.resourceId;
          if (resourceId) {
            await this.handleRemove(resourceId, context);
          }
        });
      }
    });

    // Setup drag & drop zones if they exist
    this.setupDragAndDrop(context);
    } finally {
      this.isSetupInProgress = false;
    }
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
        ui.notifications.error('Error al agregar el recurso');
      }
    }
  }

  /**
   * Handle editing an existing resource
   */
  private static async handleEdit(
    resourceId: string,
    context: ResourceEventContext
  ): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentManager not available');
      }

      // Get the resource to edit
      const resources = gm.documentManager.getGuardResources();
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Convert to our Resource type
      const resourceData = convertFoundryDocumentToResource(resource);

      const updatedResource = await AddOrEditResourceDialog.edit(resourceData);

      if (updatedResource) {
        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${updatedResource.name}" actualizado`);
        }

        context.onResourceEdited?.(updatedResource);
        context.refreshUI?.();
      }
    } catch (error) {
      console.error('ResourceEventHandler | Error editing resource:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar el recurso');
      }
    }
  }

  /**
   * Handle removing a resource
   */
  private static async handleRemove(
    resourceId: string,
    context: ResourceEventContext
  ): Promise<void> {
    try {
      const gm = (window as any).GuardManagement;
      if (!gm?.documentManager) {
        throw new Error('DocumentManager not available');
      }

      // Get resource data for confirmation
      const resource = gm.documentManager.getGuardResources().find((r: any) => r.id === resourceId);
      const resourceName = resource?.name || `Recurso ${resourceId}`;

      // Show confirmation dialog
      const confirmed = await Dialog.confirm({
        title: 'Confirmar eliminación',
        content: `<p>¿Estás seguro de que quieres remover "${resourceName}"?</p>
                  <p><small>El recurso seguirá disponible en el warehouse.</small></p>`,
      });

      if (!confirmed) return;

      if (ui?.notifications) {
        ui.notifications.info(`Recurso "${resourceName}" removido`);
      }

      context.onResourceRemoved?.(resourceId);
      context.refreshUI?.();
    } catch (error) {
      console.error('ResourceEventHandler | Error removing resource:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al eliminar el recurso');
      }
    }
  }

  /**
   * Setup drag and drop functionality
   */
  private static setupDragAndDrop(context: ResourceEventContext): void {
    const dropZones = document.querySelectorAll('.drop-zone');

    dropZones.forEach((zone) => {
      if (!zone.hasAttribute('data-resource-drop-setup')) {
        zone.setAttribute('data-resource-drop-setup', 'true');

        zone.addEventListener('dragover', this.handleDragOver.bind(this));
        zone.addEventListener('dragenter', this.handleDragEnter.bind(this));
        zone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        zone.addEventListener('drop', (event) => this.handleDrop(event, context));
      }
    });
  }

  /**
   * Handle drag over events
   */
  private static handleDragOver(event: Event): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement)?.classList.add('drag-over');
  }

  /**
   * Handle drag enter events
   */
  private static handleDragEnter(event: Event): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement)?.classList.add('drag-over');
  }

  /**
   * Handle drag leave events
   */
  private static handleDragLeave(event: Event): void {
    (event.currentTarget as HTMLElement)?.classList.remove('drag-over');
  }

  /**
   * Handle drop events
   */
  private static async handleDrop(event: Event, context: ResourceEventContext): Promise<void> {
    event.preventDefault();
    const dropZone = event.currentTarget as HTMLElement;
    dropZone.classList.remove('drag-over');

    try {
      const resourceData = JSON.parse(
        (event as DragEvent).dataTransfer?.getData('text/plain') || '{}'
      );

      if (resourceData && resourceData.id && context.organizationId) {
        // Handle resource assignment logic here
        // This would typically involve adding the resource to an organization

        context.onResourceAdded?.(resourceData);
        context.refreshUI?.();

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${resourceData.name}" asignado`);
        }
      }
    } catch (error) {
      console.error('ResourceEventHandler | Error handling drop:', error);
    }
  }

  /**
   * Clean up event listeners (call when dialog closes)
   */
  static cleanup(): void {
    // Clean up references to elements that are no longer in the DOM
    this.activeHandlers.forEach((element) => {
      if (!document.contains(element)) {
        this.activeHandlers.delete(element);
      }
    });

    // Remove all our custom attributes so elements can be re-setup (legacy cleanup)
    document.querySelectorAll('[data-resource-handler-setup]').forEach((el) => {
      el.removeAttribute('data-resource-handler-setup');
    });

    document.querySelectorAll('[data-resource-drop-setup]').forEach((el) => {
      el.removeAttribute('data-resource-drop-setup');
    });
  }

  /**
   * Force remove all handlers by cloning elements (nuclear option)
   */
  static removeAllHandlers(): void {
    document.querySelectorAll('.add-resource-btn, .edit-resource-btn, .remove-resource-btn').forEach((btn) => {
      const clonedBtn = btn.cloneNode(true);
      btn.parentNode?.replaceChild(clonedBtn, btn);
    });
  }
}
