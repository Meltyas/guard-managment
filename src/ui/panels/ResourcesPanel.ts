import type { GuardOrganization } from '../../types/entities';
import { NotificationService } from '../../utils/services/NotificationService.js';
import { ConfirmService } from '../../utils/services/ConfirmService.js';
import { ResourceTemplate } from '../ResourceTemplate.js';

export class ResourcesPanel {
  static get template() {
    return 'modules/guard-management/templates/panels/resources.hbs';
  }

  static async getData(organization: GuardOrganization) {
      const gm = (window as any).GuardManagement;
      const resources = [];
      
      console.log('ResourcesPanel.getData | Organization has', organization.resources?.length || 0, 'resource IDs');
      
      if (organization.resources && organization.resources.length > 0) {
          const allResources = gm.resourceManager?.getAllResources() || [];
          console.log('ResourcesPanel.getData | ResourceManager has', allResources.length, 'total resources');
          
          for (const id of organization.resources) {
              const r = allResources.find((res: any) => res.id === id);
              if (r) {
                  resources.push(r);
                  console.log('ResourcesPanel.getData | Found resource:', r.name);
              } else {
                  console.warn('ResourcesPanel.getData | Resource ID not found:', id);
              }
          }
      }
      
      console.log('ResourcesPanel.getData | Returning', resources.length, 'resources');
      return {
          organizationId: organization.id,
          resources
      };
  }

  static async render(container: HTMLElement, organization: GuardOrganization) {
      const data = await this.getData(organization);
      const htmlContent = await foundry.applications.handlebars.renderTemplate(this.template, data);
      
      // Use jQuery html() to forcibly replace content
      // This is more reliable than empty+append for string HTML
      console.log('ResourcesPanel | Rendering with data:', data);
      $(container).html(htmlContent);
      console.log('ResourcesPanel | DOM updated');
  }

  /**
   * Handle removing a resource
   */
  public static async handleRemoveResource(
    resourceId: string, 
    resourceName: string, 
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🗑️ Remove resource request:', resourceName, resourceId);
    
    const html = `
          <div style="margin-bottom: 1rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; margin-right: 0.5rem;"></i>
            <strong>¿Estás seguro?</strong>
          </div>
          <p>¿Deseas remover el recurso "<strong>${resourceName}</strong>" de esta organización?</p>
          <p><small>Esta acción se puede deshacer asignando el recurso nuevamente.</small></p>
        `;
    
    const confirmed = await ConfirmService.confirm({ title: 'Confirmar Remoción', html });
    
    if (!confirmed) {
      console.log('❌ Resource removal cancelled by user');
      return;
    }

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Check if resource is assigned
      if (!organization.resources || !organization.resources.includes(resourceId)) {
        console.log('ℹ️ Resource not assigned - nothing to remove');
        NotificationService.warn(
          `El recurso "${resourceName}" no está asignado a esta organización`
        );
        return;
      }

      // Create a NEW array without the resource
      const newResources = organization.resources.filter((id: string) => id !== resourceId);

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Resource removed successfully');
      NotificationService.info(`Recurso "${resourceName}" removido de la organización`);

      // Refresh dialog
      await refreshCallback();
    } catch (error) {
      console.error('❌ Error removing resource:', error);
      NotificationService.error('Error al remover el recurso de la organización');
    }
  }

  /**
   * Handle editing a resource
   */
  public static async handleEditResource(
    resourceId: string, 
    resourceName: string,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('✏️ Edit resource request:', resourceName, resourceId);

    const gm = (window as any).GuardManagement;
    if (!gm?.resourceManager) {
      console.error('❌ ResourceManager not available');
      NotificationService.error('No se pudo acceder al gestor de recursos');
      return;
    }

    try {
      // Get the resource from the resource manager
      const resources = gm.resourceManager.getAllResources() || [];
      const resource = resources.find((r: any) => r.id === resourceId);

      if (!resource) {
        console.error('❌ Resource not found:', resourceId);
        NotificationService.error('Recurso no encontrado');
        return;
      }

      const resourceData = resource; // Ya no necesita conversión

      // Import AddOrEditResourceDialog dynamically
      const { AddOrEditResourceDialog } = await import('../../dialogs/AddOrEditResourceDialog.js');

      // Show the edit dialog
      const editedResource = await AddOrEditResourceDialog.edit(resourceData);

      if (editedResource) {
        console.log('💾 Resource edited successfully, saving to database:', editedResource);

        // Save the edited resource
        const updateSuccess = await gm.resourceManager.updateResource(
          editedResource.id,
          editedResource
        );

        if (updateSuccess) {
          console.log('✅ Resource saved to database');
          NotificationService.info(`Recurso "${editedResource.name}" actualizado exitosamente`);

          // Dispatch event
          const event = new CustomEvent('guard-resource-updated', {
            detail: {
              resourceId: editedResource.id,
              updatedResource: editedResource,
              oldName: resourceData.name,
              newName: editedResource.name,
            },
          });
          window.dispatchEvent(event);

          // Refresh dialog
          await refreshCallback();
        } else {
          console.error('❌ Failed to save resource to database');
          NotificationService.error('Error al guardar el recurso en la base de datos');
        }
      }
    } catch (error) {
      console.error('❌ Error editing resource:', error);
      NotificationService.error('Error al editar el recurso');
    }
  }

  /**
   * Handle sending a resource to chat
   */
  public static async handleSendResourceToChat(resourceId: string): Promise<void> {
    console.log('💬 Send resource to chat request:', resourceId);

    try {
      await ResourceTemplate.sendResourceToChat(resourceId);
      console.log('✅ Resource sent to chat successfully');
      NotificationService.info('Recurso enviado al chat');
    } catch (error) {
      console.error('❌ Error sending resource to chat:', error);
      NotificationService.error('Error al enviar recurso al chat');
    }
  }

  /**
   * Assign a resource to the organization
   */
  public static async assignResourceToOrganization(
    resourceData: any, 
    organization: GuardOrganization,
    refreshCallback: () => Promise<void>
  ): Promise<void> {
    console.log('🔧 Assigning resource:', resourceData.name);

    const gm = (window as any).GuardManagement;

    if (!gm?.guardOrganizationManager) {
      console.error('❌ GuardOrganizationManager not available');
      return;
    }

    try {
      // Initialize resources array if it doesn't exist
      const currentResources = organization.resources || [];

      // Check if resource is already assigned
      if (currentResources.includes(resourceData.id)) {
        console.log('ℹ️ Resource already assigned - skipping');
        NotificationService.warn(
          `El recurso "${resourceData.name}" ya está asignado a esta organización`
        );
        return;
      }

      // Create a NEW array with the new resource
      const newResources = [...currentResources, resourceData.id];

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        resources: newResources,
        updatedAt: new Date(),
        version: (organization.version || 0) + 1,
      };

      // Update organization
      await gm.guardOrganizationManager.updateOrganization(updatedOrganization);

      console.log('✅ Resource assigned successfully');
      NotificationService.info(`Recurso "${resourceData.name}" asignado a la organización`);
      
      await refreshCallback();
    } catch (error) {
      console.error('❌ Error assigning resource:', error);
      NotificationService.error('Error al asignar el recurso');
      throw error;
    }
  }
}
