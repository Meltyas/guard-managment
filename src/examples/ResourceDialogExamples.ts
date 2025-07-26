/**
 * Example usage of AddOrEditResourceDialog
 * This file demonstrates how to use the reusable resource dialog throughout the module
 */

import { AddOrEditResourceDialog } from '../dialogs/AddOrEditResourceDialog';
import type { Resource } from '../types/entities';

/**
 * Example class showing how to integrate the AddOrEditResourceDialog
 */
export class ResourceDialogExamples {
  /**
   * Example: Create a new resource
   */
  static async createNewResource(organizationId: string): Promise<Resource | null> {
    try {
      // Using the static create method for convenience
      const newResource = await AddOrEditResourceDialog.create(organizationId);

      if (newResource) {
        console.log('Recurso creado:', newResource);

        // Here you would typically save the resource to your data store
        // Example: await gm.documentManager.createGuardResource(newResource);

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${newResource.name}" creado exitosamente`);
        }

        return newResource;
      }

      return null;
    } catch (error) {
      console.error('Error creando recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al crear el recurso');
      }
      return null;
    }
  }

  /**
   * Example: Edit an existing resource
   */
  static async editExistingResource(resource: Resource): Promise<Resource | null> {
    try {
      // Using the static edit method for convenience
      const updatedResource = await AddOrEditResourceDialog.edit(resource);

      if (updatedResource) {
        console.log('Recurso actualizado:', updatedResource);

        // Here you would typically save the updated resource to your data store
        // Example: await gm.documentManager.updateGuardResource(resource.id, updatedResource);

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${updatedResource.name}" actualizado exitosamente`);
        }

        return updatedResource;
      }

      return null;
    } catch (error) {
      console.error('Error editando recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al editar el recurso');
      }
      return null;
    }
  }

  /**
   * Example: Using the generic show method
   */
  static async showResourceDialog(
    mode: 'create' | 'edit',
    organizationId: string,
    existingResource?: Resource
  ): Promise<Resource | null> {
    try {
      const result = await AddOrEditResourceDialog.show(mode, organizationId, existingResource);

      if (result) {
        const action = mode === 'create' ? 'creado' : 'actualizado';
        console.log(`Recurso ${action}:`, result);

        // Handle the result based on mode
        if (mode === 'create') {
          // Example: await gm.documentManager.createGuardResource(result);
        } else {
          // Example: await gm.documentManager.updateGuardResource(result.id, result);
        }

        if (ui?.notifications) {
          ui.notifications.info(`Recurso "${result.name}" ${action} exitosamente`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error en dialog de recurso (${mode}):`, error);
      if (ui?.notifications) {
        ui.notifications.error(`Error al ${mode === 'create' ? 'crear' : 'editar'} el recurso`);
      }
      return null;
    }
  }

  /**
   * Example: Batch create multiple resources
   */
  static async createMultipleResources(
    organizationId: string,
    count: number = 3
  ): Promise<Resource[]> {
    const createdResources: Resource[] = [];

    for (let i = 0; i < count; i++) {
      const resource = await this.createNewResource(organizationId);
      if (resource) {
        createdResources.push(resource);
      } else {
        // User cancelled or error occurred
        break;
      }
    }

    if (createdResources.length > 0 && ui?.notifications) {
      ui.notifications.info(`Se crearon ${createdResources.length} recursos`);
    }

    return createdResources;
  }

  /**
   * Example: Create resource with validation hook
   */
  static async createResourceWithValidation(
    organizationId: string,
    customValidator?: (resource: Resource) => boolean
  ): Promise<Resource | null> {
    const resource = await AddOrEditResourceDialog.create(organizationId);

    if (resource && customValidator) {
      if (!customValidator(resource)) {
        if (ui?.notifications) {
          ui.notifications.warn('El recurso no cumple con los criterios de validación');
        }
        return null;
      }
    }

    return resource;
  }

  /**
   * Example integration with DocumentBasedManager
   */
  static async integrateWithDocumentManager(organizationId: string): Promise<void> {
    // Example showing integration with DocumentBasedManager
    const resource = await AddOrEditResourceDialog.create(organizationId);

    if (resource) {
      try {
        // DocumentBasedManager calls
        const gm = (window as any).GuardManagement;
        if (gm?.documentManager) {
          await gm.documentManager.createGuardResource(resource);
          // Note: Real-time sync and UI updates are handled automatically by DocumentBasedManager
        }

        console.log('Recurso integrado con DocumentBasedManager:', resource);
      } catch (error) {
        console.error('Error integrando con DocumentBasedManager:', error);
        if (ui?.notifications) {
          ui.notifications.error('Error al guardar el recurso');
        }
      }
    }
  }
}

/**
 * Example event handlers for UI integration
 */
export class ResourceDialogEventHandlers {
  /**
   * Example: Click handler for "Add Resource" button
   */
  static async onAddResourceClick(event: Event, organizationId: string): Promise<void> {
    event.preventDefault();
    await ResourceDialogExamples.createNewResource(organizationId);
  }

  /**
   * Example: Click handler for "Edit Resource" button
   */
  static async onEditResourceClick(event: Event, resource: Resource): Promise<void> {
    event.preventDefault();
    await ResourceDialogExamples.editExistingResource(resource);
  }

  /**
   * Example: Drag and drop handler for resources
   */
  static async onResourceDrop(event: DragEvent, targetOrganizationId: string): Promise<void> {
    event.preventDefault();

    // Extract resource data from drag event
    const resourceDataString = event.dataTransfer?.getData('text/plain');
    if (!resourceDataString) return;

    try {
      const resourceData = JSON.parse(resourceDataString) as Resource;

      // Show edit dialog for the dropped resource
      const updatedResource = await AddOrEditResourceDialog.edit({
        ...resourceData,
        organizationId: targetOrganizationId, // Update organization
      });

      if (updatedResource) {
        console.log('Recurso transferido y actualizado:', updatedResource);
      }
    } catch (error) {
      console.error('Error procesando drag & drop de recurso:', error);
      if (ui?.notifications) {
        ui.notifications.error('Error al procesar el recurso');
      }
    }
  }
}

/**
 * Example utility functions for the dialog
 */
export class ResourceDialogUtils {
  /**
   * Validate resource data before showing dialog
   */
  static validateResourceData(resource: Partial<Resource>): boolean {
    return !!(
      resource.name?.trim() &&
      resource.organizationId?.trim() &&
      typeof resource.quantity === 'number' &&
      resource.quantity >= 0
    );
  }

  /**
   * Create default resource template
   */
  static createResourceTemplate(organizationId: string, name: string): Partial<Resource> {
    return {
      name,
      description: '',
      quantity: 1,
      organizationId,
    };
  }

  /**
   * Format resource for display
   */
  static formatResourceForDisplay(resource: Resource): string {
    return `${resource.name} (${resource.quantity})${
      resource.description ? ` - ${resource.description}` : ''
    }`;
  }
}
